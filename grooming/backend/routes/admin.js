const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool, poolConnect, sql } = require('../db');
const { authenticateToken, checkRole } = require('../middleware/auth');

const T = {
  employees: '[Сотрудники]',
  owners: '[Владельцы]',
  pets: '[Груминг_клиенты]',
  orders: '[Заказ_груминг_услуг]',
  orderServices: '[Оказание_груминг_услуг]',
  services: '[Груминг_услуги]',
  schedule: '[Расписание_сотрудников]',
  roles: '[Должности]',
};

const C = {
  employeeId: '[Код_сотрудника]',
  employeeName: '[ФИО]',
  employeeVkId: '[VK_ID]',
  ownerId: '[Код_владельца]',
  ownerName: '[Имя_Фамилия]',
  petId: '[Код_груминг_клиента]',
  petName: '[Кличка]',
  petKind: '[Вид]',
  petBreed: '[Порода]',
  petAge: '[Возраст]',
  petSize: '[Размер]',
  orderId: '[Код_заказа]',
  orderDate: '[Дата_заказа]',
  orderTotal: '[Стоимость_оказания_услуг]',
  serviceId: '[Код_услуги]',
  serviceName: '[Наименование]',
  status: '[Статус]',
  note: '[Примечание]',
  startWork: '[Время_начала_работы]',
  endWork: '[Время_окончания_работы]',
  duration: '[Длительность]',
  servicePrice: '[Цена_за_услугу]',
  serviceRoleId: '[ID_должности]',
  scheduleId: '[ID]',
  scheduleDate: '[Дата]',
  scheduleStart: '[Время_начала]',
  scheduleEnd: '[Время_окончания]',
  scheduleRoleId: '[ID_должности]',
};

const ROLE_IDS = {
  cashier: 'CAEBA1F4-A104-4C06-A398-20BECA42B0B0',
  admin: '88FCD70F-3EA6-400D-B233-647C30C4EA7E',
  assistantGroomer: 'A0261582-900D-42C5-9C4B-6D6F60C23A36',
  groomer: '882CB015-95ED-4C8E-B918-6E7C82606801',
  seniorGroomer: '5EEFB7DC-57E8-404B-94D0-B641D7F6D696',
  manager: 'DD19D48D-A2C4-4E3C-A762-EB125B31BB19',
};

const ALLOWED_ROLE_IDS = Object.values(ROLE_IDS);
const ROLE_RATE_BY_ID = {
  [ROLE_IDS.seniorGroomer]: 0.45,
  [ROLE_IDS.groomer]: 0.35,
  [ROLE_IDS.assistantGroomer]: 0.25,
};

const sendDbError = (res, err, context) =>
  res.status(500).json({ error: 'Database query failed', context, details: err.message });

const normalizeTime = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
  return null;
};

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isCancelledStatus = (status) => /отмен|cancel/i.test(String(status || ''));
const isCompletedStatus = (status) => /выполн|completed/i.test(String(status || ''));
const formatMonthLabel = (date) => date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

const buildMonthlyStats = (orderRows = [], scheduleRows = []) => {
  const monthMap = new Map();

  for (const row of orderRows) {
    const sourceDate = toDate(row.startTime) || toDate(row.orderDate);
    if (!sourceDate) continue;

    const key = `${sourceDate.getFullYear()}-${String(sourceDate.getMonth() + 1).padStart(2, '0')}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, {
        key,
        label: formatMonthLabel(sourceDate),
        orderIds: new Set(),
        services: 0,
        revenue: 0,
        salary: 0,
        completedServices: 0,
        cancelledServices: 0,
        shifts: 0,
      });
    }

    const item = monthMap.get(key);
    item.orderIds.add(row.orderId);
    item.services += 1;

    if (isCancelledStatus(row.serviceStatus)) {
      item.cancelledServices += 1;
      continue;
    }

    const servicePrice = Number(row.servicePrice) || 0;
    item.revenue += servicePrice;
    item.salary += servicePrice * (ROLE_RATE_BY_ID[row.roleId] || 0);

    if (isCompletedStatus(row.serviceStatus)) {
      item.completedServices += 1;
    }
  }

  for (const row of scheduleRows) {
    const sourceDate = toDate(row.scheduleDate);
    if (!sourceDate) continue;

    const key = `${sourceDate.getFullYear()}-${String(sourceDate.getMonth() + 1).padStart(2, '0')}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, {
        key,
        label: formatMonthLabel(sourceDate),
        orderIds: new Set(),
        services: 0,
        revenue: 0,
        salary: 0,
        completedServices: 0,
        cancelledServices: 0,
        shifts: 0,
      });
    }
    monthMap.get(key).shifts += 1;
  }

  return Array.from(monthMap.values())
    .map((item) => ({
      key: item.key,
      label: item.label,
      totalOrders: item.orderIds.size,
      totalServices: item.services,
      completedServices: item.completedServices,
      cancelledServices: item.cancelledServices,
      shifts: item.shifts,
      revenue: Number(item.revenue.toFixed(2)),
      salary: Number(item.salary.toFixed(2)),
    }))
    .sort((a, b) => b.key.localeCompare(a.key));
};

const buildSummary = ({ orderRows, scheduleRows, totalClients, totalEmployees, monthlyStats }) => {
  const groupedOrders = new Map();

  for (const row of orderRows) {
    if (!groupedOrders.has(row.orderId)) {
      groupedOrders.set(row.orderId, []);
    }
    groupedOrders.get(row.orderId).push(row);
  }

  let activeOrders = 0;
  let totalRevenue = 0;
  let totalSalary = 0;

  for (const rows of groupedOrders.values()) {
    const hasActiveService = rows.some((row) => !isCancelledStatus(row.serviceStatus) && !isCompletedStatus(row.serviceStatus));
    if (hasActiveService) {
      activeOrders += 1;
    }

    for (const row of rows) {
      if (isCancelledStatus(row.serviceStatus)) continue;
      const servicePrice = Number(row.servicePrice) || 0;
      totalRevenue += servicePrice;
      totalSalary += servicePrice * (ROLE_RATE_BY_ID[row.roleId] || 0);
    }
  }

  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonth = monthlyStats.find((item) => item.key === currentKey);
  const upcomingShifts = scheduleRows.filter((row) => {
    const date = row.scheduleDate ? String(row.scheduleDate).split('T')[0] : '';
    const end = row.scheduleEnd || '00:00';
    const dateTime = new Date(`${date}T${end}:00`);
    return !Number.isNaN(dateTime.getTime()) && dateTime.getTime() >= now.getTime();
  }).length;

  return {
    totalOrders: groupedOrders.size,
    activeOrders,
    totalClients,
    totalEmployees,
    totalRevenue: Number(totalRevenue.toFixed(2)),
    totalSalary: Number(totalSalary.toFixed(2)),
    totalShifts: scheduleRows.length,
    upcomingShifts,
    currentMonthRevenue: currentMonth?.revenue || 0,
    currentMonthSalary: currentMonth?.salary || 0,
    currentMonthOrders: currentMonth?.totalOrders || 0,
  };
};

const loadDashboardPayload = async () => {
  const [ownersResult, employeesResult, rolesResult, ordersResult, scheduleResult] = await Promise.all([
    pool.request().query(`SELECT COUNT(*) as totalClients FROM ${T.owners}`),
    pool.request().query(`
      SELECT e.${C.employeeId} as employeeId,
             e.${C.employeeName} as fullName,
             e.${C.employeeVkId} as vkId
      FROM ${T.employees} e
      ORDER BY e.${C.employeeName} ASC
    `),
    pool.request().query(`
      SELECT r.[ID_должности] as roleId,
             r.[Наименование] as roleName
      FROM ${T.roles} r
      WHERE r.[ID_должности] IN (${ALLOWED_ROLE_IDS.map((id) => `'${id}'`).join(', ')})
      ORDER BY r.[Наименование] ASC
    `),
    pool.request().query(`
      SELECT o.${C.orderId} as orderId,
             o.${C.orderDate} as orderDate,
             o.${C.orderTotal} as orderTotal,
             o.${C.ownerId} as ownerId,
             cl.${C.ownerName} as clientName,
             pet.${C.petId} as petId,
             pet.${C.petName} as petName,
             pet.${C.petKind} as petKind,
             pet.${C.petBreed} as petBreed,
             pet.${C.petAge} as petAge,
             pet.${C.petSize} as petSize,
             s.${C.employeeId} as employeeId,
             s.${C.employeeName} as employeeName,
             og.${C.serviceRoleId} as roleId,
             role.[Наименование] as roleName,
             g.${C.serviceId} as serviceId,
             g.${C.serviceName} as serviceName,
             og.${C.status} as serviceStatus,
             og.${C.note} as note,
             og.${C.startWork} as startTime,
             og.${C.endWork} as endTime,
             og.${C.duration} as duration,
             og.${C.servicePrice} as servicePrice
      FROM ${T.orderServices} og
      JOIN ${T.orders} o ON og.${C.orderId} = o.${C.orderId}
      LEFT JOIN ${T.owners} cl ON o.${C.ownerId} = cl.${C.ownerId}
      LEFT JOIN ${T.pets} pet ON o.${C.petId} = pet.${C.petId}
      LEFT JOIN ${T.services} g ON og.${C.serviceId} = g.${C.serviceId}
      LEFT JOIN ${T.employees} s ON og.${C.employeeId} = s.${C.employeeId}
      LEFT JOIN ${T.roles} role ON og.${C.serviceRoleId} = role.[ID_должности]
      ORDER BY og.${C.startWork} DESC, o.${C.orderDate} DESC
    `),
    pool.request().query(`
      SELECT sch.${C.scheduleId} as scheduleId,
             sch.${C.employeeId} as employeeId,
             e.${C.employeeName} as employeeName,
             sch.${C.scheduleRoleId} as roleId,
             role.[Наименование] as roleName,
             sch.${C.scheduleDate} as scheduleDate,
             CONVERT(varchar(5), sch.${C.scheduleStart}, 108) as scheduleStart,
             CONVERT(varchar(5), sch.${C.scheduleEnd}, 108) as scheduleEnd
      FROM ${T.schedule} sch
      LEFT JOIN ${T.employees} e ON sch.${C.employeeId} = e.${C.employeeId}
      LEFT JOIN ${T.roles} role ON sch.${C.scheduleRoleId} = role.[ID_должности]
      ORDER BY sch.${C.scheduleDate} DESC, sch.${C.scheduleStart} ASC, e.${C.employeeName} ASC
    `),
  ]);

  const employees = employeesResult.recordset || [];
  const roles = rolesResult.recordset || [];
  const orders = ordersResult.recordset || [];
  const schedule = scheduleResult.recordset || [];
  const monthlyStats = buildMonthlyStats(orders, schedule);
  const summary = buildSummary({
    orderRows: orders,
    scheduleRows: schedule,
    totalClients: ownersResult.recordset[0]?.totalClients || 0,
    totalEmployees: employees.length,
    monthlyStats,
  });

  return { summary, monthlyStats, employees, roles, orders, schedule };
};

router.get('/dashboard', authenticateToken, checkRole(['admin']), async (_req, res) => {
  try {
    await poolConnect;
    const payload = await loadDashboardPayload();
    res.json(payload);
  } catch (err) {
    sendDbError(res, err, 'admin.dashboard');
  }
});

router.get('/orders', authenticateToken, checkRole(['admin']), async (_req, res) => {
  try {
    await poolConnect;
    const payload = await loadDashboardPayload();
    res.json(payload.orders);
  } catch (err) {
    sendDbError(res, err, 'admin.orders.list');
  }
});

router.post('/schedule', authenticateToken, checkRole(['admin']), async (req, res) => {
  try {
    await poolConnect;
    const { employeeId, date, startTime, endTime, roleId } = req.body || {};

    if (!employeeId || !date || !startTime || !endTime || !roleId) {
      return res.status(400).json({ error: 'employeeId, date, startTime, endTime and roleId are required' });
    }

    if (!ALLOWED_ROLE_IDS.includes(roleId)) {
      return res.status(400).json({ error: 'Role is not allowed for schedule' });
    }

    const normalizedStart = normalizeTime(startTime);
    const normalizedEnd = normalizeTime(endTime);
    if (!normalizedStart || !normalizedEnd) {
      return res.status(400).json({ error: 'Invalid time format' });
    }

    const scheduleId = uuidv4();

    await pool.request()
      .input('scheduleId', sql.UniqueIdentifier, scheduleId)
      .input('employeeId', sql.UniqueIdentifier, employeeId)
      .input('roleId', sql.UniqueIdentifier, roleId)
      .input('date', sql.Date, date)
      .input('startTimeText', sql.VarChar(8), normalizedStart)
      .input('endTimeText', sql.VarChar(8), normalizedEnd)
      .query(`
        INSERT INTO ${T.schedule}
        (${C.scheduleId}, ${C.employeeId}, ${C.scheduleRoleId}, ${C.scheduleDate}, ${C.scheduleStart}, ${C.scheduleEnd})
        VALUES (@scheduleId, @employeeId, @roleId, @date, CAST(@startTimeText AS time), CAST(@endTimeText AS time))
      `);

    res.json({ success: true, scheduleId });
  } catch (err) {
    sendDbError(res, err, 'admin.schedule.create');
  }
});

router.patch('/schedule/:scheduleId', authenticateToken, checkRole(['admin']), async (req, res) => {
  try {
    await poolConnect;
    const { scheduleId } = req.params;
    const { employeeId, date, startTime, endTime, roleId } = req.body || {};

    if (!employeeId || !date || !startTime || !endTime || !roleId) {
      return res.status(400).json({ error: 'employeeId, date, startTime, endTime and roleId are required' });
    }

    if (!ALLOWED_ROLE_IDS.includes(roleId)) {
      return res.status(400).json({ error: 'Role is not allowed for schedule' });
    }

    const normalizedStart = normalizeTime(startTime);
    const normalizedEnd = normalizeTime(endTime);
    if (!normalizedStart || !normalizedEnd) {
      return res.status(400).json({ error: 'Invalid time format' });
    }

    await pool.request()
      .input('scheduleId', sql.UniqueIdentifier, scheduleId)
      .input('employeeId', sql.UniqueIdentifier, employeeId)
      .input('roleId', sql.UniqueIdentifier, roleId)
      .input('date', sql.Date, date)
      .input('startTimeText', sql.VarChar(8), normalizedStart)
      .input('endTimeText', sql.VarChar(8), normalizedEnd)
      .query(`
        UPDATE ${T.schedule}
        SET ${C.employeeId} = @employeeId,
            ${C.scheduleRoleId} = @roleId,
            ${C.scheduleDate} = @date,
            ${C.scheduleStart} = CAST(@startTimeText AS time),
            ${C.scheduleEnd} = CAST(@endTimeText AS time)
        WHERE ${C.scheduleId} = @scheduleId
      `);

    res.json({ success: true });
  } catch (err) {
    sendDbError(res, err, 'admin.schedule.update');
  }
});

router.delete('/schedule/:scheduleId', authenticateToken, checkRole(['admin']), async (req, res) => {
  try {
    await poolConnect;
    const { scheduleId } = req.params;

    await pool.request()
      .input('scheduleId', sql.UniqueIdentifier, scheduleId)
      .query(`DELETE FROM ${T.schedule} WHERE ${C.scheduleId} = @scheduleId`);

    res.json({ success: true });
  } catch (err) {
    sendDbError(res, err, 'admin.schedule.delete');
  }
});

module.exports = router;
