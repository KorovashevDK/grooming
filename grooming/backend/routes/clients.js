const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../db');
const { authenticateToken, checkRole } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const T = {
  owners: '[\u0412\u043b\u0430\u0434\u0435\u043b\u044c\u0446\u044b]',
  orders: '[\u0417\u0430\u043a\u0430\u0437_\u0433\u0440\u0443\u043c\u0438\u043d\u0433_\u0443\u0441\u043b\u0443\u0433]',
  orderServices: '[\u041e\u043a\u0430\u0437\u0430\u043d\u0438\u0435_\u0433\u0440\u0443\u043c\u0438\u043d\u0433_\u0443\u0441\u043b\u0443\u0433]',
  services: '[\u0413\u0440\u0443\u043c\u0438\u043d\u0433_\u0443\u0441\u043b\u0443\u0433\u0438]',
  employees: '[\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0438]',
  pets: '[\u0413\u0440\u0443\u043c\u0438\u043d\u0433_\u043a\u043b\u0438\u0435\u043d\u0442\u044b]',
  schedule: '[\u0420\u0430\u0441\u043f\u0438\u0441\u0430\u043d\u0438\u0435_\u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u043e\u0432]',
  roles: '[\u0414\u043e\u043b\u0436\u043d\u043e\u0441\u0442\u0438]',
};

const C = {
  ownerId: '[\u041a\u043e\u0434_\u0432\u043b\u0430\u0434\u0435\u043b\u044c\u0446\u0430]',
  ownerName: '[\u0418\u043c\u044f_\u0424\u0430\u043c\u0438\u043b\u0438\u044f]',
  ownerPhone: '[\u041d\u043e\u043c\u0435\u0440_\u0442\u0435\u043b\u0435\u0444\u043e\u043d\u0430]',
  orderId: '[\u041a\u043e\u0434_\u0437\u0430\u043a\u0430\u0437\u0430]',
  orderPetId: '[\u041a\u043e\u0434_\u0433\u0440\u0443\u043c\u0438\u043d\u0433_\u043a\u043b\u0438\u0435\u043d\u0442\u0430]',
  orderDate: '[\u0414\u0430\u0442\u0430_\u0437\u0430\u043a\u0430\u0437\u0430]',
  orderPrice: '[\u0421\u0442\u043e\u0438\u043c\u043e\u0441\u0442\u044c_\u043e\u043a\u0430\u0437\u0430\u043d\u0438\u044f_\u0443\u0441\u043b\u0443\u0433]',
  serviceId: '[\u041a\u043e\u0434_\u0443\u0441\u043b\u0443\u0433\u0438]',
  serviceName: '[\u041d\u0430\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u043d\u0438\u0435]',
  employeeId: '[\u041a\u043e\u0434_\u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430]',
  employeeName: '[\u0424\u0418\u041e]',
  status: '[\u0421\u0442\u0430\u0442\u0443\u0441]',
  note: '[\u041f\u0440\u0438\u043c\u0435\u0447\u0430\u043d\u0438\u0435]',
  servicePrice: '[\u0426\u0435\u043d\u0430_\u0437\u0430_\u0443\u0441\u043b\u0443\u0433\u0443]',
  petId: '[\u041a\u043e\u0434_\u0433\u0440\u0443\u043c\u0438\u043d\u0433_\u043a\u043b\u0438\u0435\u043d\u0442\u0430]',
  petSize: '[\u0420\u0430\u0437\u043c\u0435\u0440]',
  orderStart: '[\u0412\u0440\u0435\u043c\u044f_\u043d\u0430\u0447\u0430\u043b\u0430_\u0440\u0430\u0431\u043e\u0442\u044b]',
  orderEnd: '[\u0412\u0440\u0435\u043c\u044f_\u043e\u043a\u043e\u043d\u0447\u0430\u043d\u0438\u044f_\u0440\u0430\u0431\u043e\u0442\u044b]',
  orderDuration: '[\u0414\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c]',
  scheduleId: '[ID]',
  scheduleDate: '[\u0414\u0430\u0442\u0430]',
  scheduleStart: '[\u0412\u0440\u0435\u043c\u044f_\u043d\u0430\u0447\u0430\u043b\u0430]',
  scheduleEnd: '[\u0412\u0440\u0435\u043c\u044f_\u043e\u043a\u043e\u043d\u0447\u0430\u043d\u0438\u044f]',
  scheduleRoleId: '[ID_\u0434\u043e\u043b\u0436\u043d\u043e\u0441\u0442\u0438]',
};

const SIZE_COEFFICIENTS = {
  small: 1,
  medium: 1.3,
  large: 1.6,
};

const GROOMER_ROLE_IDS = [
  'A0261582-900D-42C5-9C4B-6D6F60C23A36', // Помощник грумера
  '882CB015-95ED-4C8E-B918-6E7C82606801', // Грумер
  '5EEFB7DC-57E8-404B-94D0-B641D7F6D696', // Старший грумер
];

const GROOMER_LEVEL_COEFFICIENTS = {
  'A0261582-900D-42C5-9C4B-6D6F60C23A36': 0.9,
  '882CB015-95ED-4C8E-B918-6E7C82606801': 1,
  '5EEFB7DC-57E8-404B-94D0-B641D7F6D696': 1.1,
};

const getRecencyCoefficient = (recency) => {
  const value = String(recency || '').trim().toLowerCase();
  if (!value || value === 'recent') return 1;
  if (value === '1_3_months') return 1.05;
  if (value === '3_plus_months') return 1.1;
  if (value === 'never') return 1.15;
  return 1;
};

const getRecencyLabel = (recency) => {
  const value = String(recency || '').trim().toLowerCase();
  if (value === '1_3_months') return '1-3 месяца назад';
  if (value === '3_plus_months') return 'Более 3 месяцев назад';
  if (value === 'never') return 'Никогда';
  return 'Меньше месяца назад';
};

const buildClientOrderNote = ({ groomingRecency, clientComment }) => {
  const parts = [];
  parts.push(`Последний визит: ${getRecencyLabel(groomingRecency)}`);

  if (String(clientComment || '').trim()) {
    parts.push(`Комментарий клиента: ${String(clientComment).trim()}`);
  } else {
    parts.push('Комментарий клиента:');
  }

  parts.push('Комментарий мастера:');

  return parts.join('; ');
};

const LOCAL_TIME_OFFSET_MINUTES = 180;

const sendDbError = (res, err, context) =>
  res.status(500).json({ error: 'Database query failed', context, details: err.message });

const isSchemaError = (err) =>
  /Invalid column name|Invalid object name|could not be bound|Ambiguous column name/i.test(err?.message || '');

const normalizeSize = (value) => {
  if (!value) return null;
  const raw = String(value).trim().toLowerCase();
  if (['small', 's', 'маленький', 'малый'].includes(raw)) return 'small';
  if (['medium', 'm', 'средний'].includes(raw)) return 'medium';
  if (['large', 'l', 'большой', 'крупный'].includes(raw)) return 'large';
  return null;
};

const parseDateOnly = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildDateTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  const date = new Date(`${dateStr}T${timeStr}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60000);

const formatTime = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const parseTimeToMinutes = (value) => {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^(\d{2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const minutesToTime = (totalMinutes) => {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return null;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const formatTimeSeconds = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    if (/^\d{2}:\d{2}:\d{2}$/.test(value)) return value;
    if (/^\d{2}:\d{2}$/.test(value)) return `${value}:00`;
    return null;
  }
  if (value instanceof Date) {
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    const seconds = String(value.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }
  return null;
};

const toTimeString = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    return value.length >= 5 ? value.slice(0, 5) : value;
  }
  const date = new Date(value);
  return formatTime(date);
};

const toShortEmployeeName = (fullName) => {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[1]} ${parts[0]}`;
  }
  return String(fullName || '').trim();
};

router.get('/profile', authenticateToken, checkRole(['client', 'admin', 'groomer']), async (req, res) => {
  try {
    await poolConnect;

    const query = `
      SELECT *, ${C.ownerName} as [ФИО]
      FROM ${T.owners}
      WHERE ${C.ownerId} = @userId
    `;

    const clientResult = await pool.request().input('userId', sql.UniqueIdentifier, req.user.userId).query(query);

    if (clientResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(clientResult.recordset[0]);
  } catch (err) {
    sendDbError(res, err, 'clients.profile');
  }
});

router.get('/orders', authenticateToken, checkRole(['client', 'admin', 'groomer']), async (req, res) => {
  try {
    await poolConnect;

    const baseQuery = `
      SELECT o.*, g.${C.serviceName} as serviceName, s.${C.employeeName} as employeeName, og.${C.note} as note,
             p.[Кличка] as petName, p.[Вид] as petKind, p.[Порода] as petBreed, p.[Размер] as petSize,
             og.${C.status} as serviceStatus, og.${C.orderStart} as serviceStart, og.${C.orderEnd} as serviceEnd, og.${C.orderDuration} as serviceDuration
      FROM ${T.orders} o
      LEFT JOIN ${T.orderServices} og ON o.${C.orderId} = og.${C.orderId}
      LEFT JOIN ${T.services} g ON og.${C.serviceId} = g.${C.serviceId}
      LEFT JOIN ${T.employees} s ON og.${C.employeeId} = s.${C.employeeId}
      LEFT JOIN ${T.pets} p ON o.${C.orderPetId} = p.${C.petId}
      WHERE o.${C.ownerId} = @userId
      ORDER BY o.${C.orderDate} DESC
    `;

    const queryWithPrice = `
      SELECT o.*, g.${C.serviceName} as serviceName, s.${C.employeeName} as employeeName, og.${C.servicePrice} as servicePrice, og.${C.note} as note,
             p.[Кличка] as petName, p.[Вид] as petKind, p.[Порода] as petBreed, p.[Размер] as petSize,
             og.${C.status} as serviceStatus, og.${C.orderStart} as serviceStart, og.${C.orderEnd} as serviceEnd, og.${C.orderDuration} as serviceDuration
      FROM ${T.orders} o
      LEFT JOIN ${T.orderServices} og ON o.${C.orderId} = og.${C.orderId}
      LEFT JOIN ${T.services} g ON og.${C.serviceId} = g.${C.serviceId}
      LEFT JOIN ${T.employees} s ON og.${C.employeeId} = s.${C.employeeId}
      LEFT JOIN ${T.pets} p ON o.${C.orderPetId} = p.${C.petId}
      WHERE o.${C.ownerId} = @userId
      ORDER BY o.${C.orderDate} DESC
    `;

    let ordersResult;
    try {
      ordersResult = await pool.request().input('userId', sql.UniqueIdentifier, req.user.userId).query(queryWithPrice);
    } catch (err) {
      if (!isSchemaError(err)) {
        throw err;
      }
      ordersResult = await pool.request().input('userId', sql.UniqueIdentifier, req.user.userId).query(baseQuery);
    }

    res.json(ordersResult.recordset);
  } catch (err) {
    sendDbError(res, err, 'clients.orders.list');
  }
});

router.post('/availability', authenticateToken, checkRole(['client', 'admin', 'groomer']), async (req, res) => {
  try {
    const { date, serviceIds } = req.body;
    const normalizedServiceIds = Array.isArray(serviceIds) ? serviceIds.filter(Boolean) : [];
    if (!date || normalizedServiceIds.length === 0) {
      return res.status(400).json({ error: 'date and serviceIds are required' });
    }

    const dateOnly = parseDateOnly(date);
    if (!dateOnly) {
      return res.status(400).json({ error: 'Invalid date value' });
    }

    await poolConnect;

    const serviceRequest = pool.request();
    const serviceIdParams = normalizedServiceIds.map((id, index) => {
      const param = `serviceId${index}`;
      serviceRequest.input(param, sql.UniqueIdentifier, id);
      return `@${param}`;
    });

    const servicesResult = await serviceRequest.query(`
      SELECT *
      FROM ${T.services}
      WHERE ${C.serviceId} IN (${serviceIdParams.join(', ')})
    `);

    if (servicesResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Services not found' });
    }

    const getServiceDuration = (row) => {
      const raw = row['Длительность_мин'];
      const numeric = Number(raw);
      return Number.isFinite(numeric) && numeric > 0 ? numeric : 60;
    };

    const totalDurationMinutes = servicesResult.recordset.reduce((sum, row) => sum + getServiceDuration(row), 0);
    const stepMinutes = 30;

    const scheduleRequest = pool.request()
      .input('dateOnly', sql.Date, dateOnly)
      .input('roleId0', sql.UniqueIdentifier, GROOMER_ROLE_IDS[0])
      .input('roleId1', sql.UniqueIdentifier, GROOMER_ROLE_IDS[1])
      .input('roleId2', sql.UniqueIdentifier, GROOMER_ROLE_IDS[2]);

    const scheduleResult = await scheduleRequest
      .query(`
        SELECT sch.${C.scheduleId} as scheduleId,
               sch.${C.scheduleDate} as scheduleDate,
               CONVERT(varchar(5), sch.${C.scheduleStart}, 108) as scheduleStart,
               CONVERT(varchar(5), sch.${C.scheduleEnd}, 108) as scheduleEnd,
               sch.${C.scheduleRoleId} as roleId,
               emp.${C.employeeId} as employeeId,
               emp.${C.employeeName} as employeeName,
               role.[Наименование] as roleName
        FROM ${T.schedule} sch
        JOIN ${T.employees} emp ON sch.${C.employeeId} = emp.${C.employeeId}
        LEFT JOIN ${T.roles} role ON role.[ID_должности] = sch.${C.scheduleRoleId}
        WHERE sch.${C.scheduleDate} = @dateOnly
          AND sch.${C.scheduleRoleId} IN (@roleId0, @roleId1, @roleId2)
      `);

    const schedules = scheduleResult.recordset;
    if (schedules.length === 0) {
      return res.json({ durationMinutes: totalDurationMinutes, stepMinutes, employees: [] });
    }

    const employeeIds = schedules.map((row) => row.employeeId);
    const bookingRequest = pool.request();

    const employeeParams = employeeIds.map((id, index) => {
      const param = `emp${index}`;
      bookingRequest.input(param, sql.UniqueIdentifier, id);
      return `@${param}`;
    });

    bookingRequest
      .input('dateOnly', sql.Date, dateOnly)
      .input('tzOffset', sql.Int, LOCAL_TIME_OFFSET_MINUTES);

    const bookingsResult = await bookingRequest.query(`
      SELECT ${C.employeeId} as employeeId,
             CONVERT(varchar(10), DATEADD(MINUTE, @tzOffset, ${C.orderStart}), 23) as startDate,
             (DATEPART(HOUR, DATEADD(MINUTE, @tzOffset, ${C.orderStart})) * 60
               + DATEPART(MINUTE, DATEADD(MINUTE, @tzOffset, ${C.orderStart}))) as startMinutes,
             (DATEPART(HOUR, DATEADD(MINUTE, @tzOffset, ${C.orderEnd})) * 60
               + DATEPART(MINUTE, DATEADD(MINUTE, @tzOffset, ${C.orderEnd}))) as endMinutes
      FROM ${T.orderServices}
      WHERE ${C.employeeId} IN (${employeeParams.join(', ')})
        AND ${C.orderStart} IS NOT NULL
        AND ${C.orderEnd} IS NOT NULL
        AND (${C.status} IS NULL OR ${C.status} NOT IN (N'Отменена', N'Отменён', N'Отменен'))
    `);

    const bookingsByEmployee = new Map();
    for (const row of bookingsResult.recordset) {
      if (!bookingsByEmployee.has(row.employeeId)) {
        bookingsByEmployee.set(row.employeeId, []);
      }
      if (row.startDate !== date) {
        continue;
      }

      const startMinutes = Number(row.startMinutes);
      const endMinutes = Number(row.endMinutes);
      if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
        continue;
      }
      bookingsByEmployee.get(row.employeeId).push({
        startMinutes,
        endMinutes,
      });
    }

    const employeesMap = new Map();

    for (const row of schedules) {
      if (!employeesMap.has(row.employeeId)) {
        employeesMap.set(row.employeeId, {
          id: row.employeeId,
          fullName: toShortEmployeeName(row.employeeName),
          displayName: `${toShortEmployeeName(row.employeeName)}${row.roleName ? ` · ${row.roleName}` : ''}`,
          roleId: row.roleId,
          roleName: row.roleName || '',
          levelCoefficient: GROOMER_LEVEL_COEFFICIENTS[row.roleId] || 1,
          slots: new Set(),
        });
      }

      const scheduleStart = toTimeString(row.scheduleStart);
      const scheduleEnd = toTimeString(row.scheduleEnd);
      const scheduleStartMinutes = parseTimeToMinutes(scheduleStart);
      const scheduleEndMinutes = parseTimeToMinutes(scheduleEnd);

      if (scheduleStartMinutes === null || scheduleEndMinutes === null) {
        continue;
      }

      for (let cursorMinutes = scheduleStartMinutes; cursorMinutes + totalDurationMinutes <= scheduleEndMinutes; cursorMinutes += stepMinutes) {
        const slotEndMinutes = cursorMinutes + totalDurationMinutes;
        const conflicts = (bookingsByEmployee.get(row.employeeId) || []).some(
          (booking) => booking.startMinutes < slotEndMinutes && booking.endMinutes > cursorMinutes,
        );
        if (!conflicts) {
          const slotLabel = minutesToTime(cursorMinutes);
          if (slotLabel) {
            employeesMap.get(row.employeeId).slots.add(slotLabel);
          }
        }
      }
    }

    const employees = Array.from(employeesMap.values()).map((employee) => ({
      ...employee,
      slots: Array.from(employee.slots).sort(),
    }));

    res.json({ durationMinutes: totalDurationMinutes, stepMinutes, employees });
  } catch (err) {
    sendDbError(res, err, 'clients.availability');
  }
});

router.post('/orders', authenticateToken, checkRole(['client', 'admin', 'groomer']), async (req, res) => {
  const transaction = new sql.Transaction(pool);

  try {
    const { petId, serviceId, serviceIds, employeeId, date, time, price, groomingRecency, clientComment } = req.body;
    const ownerId = req.user.userId;
    const normalizedServiceIds = Array.isArray(serviceIds)
      ? serviceIds.filter(Boolean)
      : serviceId
        ? [serviceId]
        : [];

    if (!petId || normalizedServiceIds.length === 0 || !employeeId || !date || !time) {
      return res.status(400).json({ error: 'petId, serviceId(s), employeeId, date and time are required' });
    }

    const orderDateTime = buildDateTime(date, time);
    if (!orderDateTime) {
      return res.status(400).json({ error: 'Invalid date/time value' });
    }

    await poolConnect;
    await transaction.begin();

    const verifyPetQuery = `
      SELECT ${C.petSize} as petSize
      FROM ${T.pets}
      WHERE ${C.petId} = @petId
    `;

    let petSize = null;
    try {
      const verifyPetResult = await new sql.Request(transaction)
        .input('petId', sql.UniqueIdentifier, petId)
        .query(verifyPetQuery);

      if (verifyPetResult.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Pet not found' });
      }

      petSize = verifyPetResult.recordset[0]?.petSize || null;
    } catch (err) {
      if (!isSchemaError(err)) {
        throw err;
      }

      const fallbackPetQuery = `
        SELECT 1
        FROM ${T.pets}
        WHERE ${C.petId} = @petId
      `;

      const verifyPetResult = await new sql.Request(transaction)
        .input('petId', sql.UniqueIdentifier, petId)
        .query(fallbackPetQuery);

      if (verifyPetResult.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Pet not found' });
      }
    }

    const normalizedSize = normalizeSize(petSize);
    const sizeCoefficient = SIZE_COEFFICIENTS[normalizedSize || 'small'] || 1;

    const orderId = uuidv4();

    const serviceRequest = new sql.Request(transaction);
    const serviceIdParams = normalizedServiceIds.map((id, index) => {
      const param = `serviceId${index}`;
      serviceRequest.input(param, sql.UniqueIdentifier, id);
      return `@${param}`;
    });

    const servicesQuery = `
      SELECT *
      FROM ${T.services}
      WHERE ${C.serviceId} IN (${serviceIdParams.join(', ')})
    `;

    const servicesResult = await serviceRequest.query(servicesQuery);

    if (servicesResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Services not found' });
    }

    const getServiceBasePrice = (row) => {
      const candidates = [
        '\u0411\u0430\u0437\u043e\u0432\u0430\u044f_\u0446\u0435\u043d\u0430',
        '\u0426\u0435\u043d\u0430',
        '\u0421\u0442\u043e\u0438\u043c\u043e\u0441\u0442\u044c',
      ];
      for (const key of candidates) {
        const raw = row[key];
        const numeric = Number(raw);
        if (Number.isFinite(numeric)) {
          return numeric;
        }
      }
      return null;
    };

    const getServiceDuration = (row) => {
      const raw = row['\u0414\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c_\u043c\u0438\u043d'];
      const numeric = Number(raw);
      return Number.isFinite(numeric) && numeric > 0 ? numeric : 60;
    };

    const serviceBasePriceById = new Map();
    const serviceDurationById = new Map();
    let totalDurationMinutes = 0;
    for (const row of servicesResult.recordset) {
      const rowId = row['\u041a\u043e\u0434_\u0443\u0441\u043b\u0443\u0433\u0438'];
      const rowPrice = getServiceBasePrice(row);
      const rowDuration = getServiceDuration(row);
      serviceBasePriceById.set(rowId, rowPrice);
      serviceDurationById.set(rowId, rowDuration);
      totalDurationMinutes += rowDuration;
    }

    const missingService = normalizedServiceIds.find((id) => !serviceBasePriceById.has(id));
    if (missingService) {
      await transaction.rollback();
      return res.status(404).json({ error: 'One or more services not found' });
    }

    const fallbackBasePrice = Number.isFinite(Number(price)) ? Number(price) : 0;
    const recencyCoefficient = getRecencyCoefficient(groomingRecency);

    const totalPrice = normalizedServiceIds.reduce((sum, id) => {
      const basePrice = serviceBasePriceById.get(id);
      const safeBase = Number.isFinite(basePrice) ? basePrice : fallbackBasePrice;
      return sum + safeBase * sizeCoefficient * recencyCoefficient;
    }, 0);

    const createOrderQuery = `
      INSERT INTO ${T.orders}
      (${C.orderId}, ${C.orderPetId}, ${C.ownerId}, ${C.orderDate}, ${C.orderPrice})
      VALUES (@orderId, @petId, @ownerId, @date, @price)
    `;

    const createdAt = new Date();

    await new sql.Request(transaction)
      .input('orderId', sql.UniqueIdentifier, orderId)
      .input('petId', sql.UniqueIdentifier, petId)
      .input('ownerId', sql.UniqueIdentifier, ownerId)
      .input('date', sql.DateTime, createdAt)
      .input('price', sql.Numeric(10, 2), totalPrice)
      .query(createOrderQuery);

    const employeeCheck = await new sql.Request(transaction)
      .input('employeeId', sql.UniqueIdentifier, employeeId)
      .query(`
        SELECT 1
        FROM ${T.employees}
        WHERE ${C.employeeId} = @employeeId
      `);

    if (employeeCheck.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Employee not found' });
    }

    const slotEndTime = addMinutes(orderDateTime, totalDurationMinutes);

    const scheduleRows = await new sql.Request(transaction)
      .input('employeeId', sql.UniqueIdentifier, employeeId)
      .input('scheduleDate', sql.Date, parseDateOnly(date))
      .query(`
        SELECT ${C.scheduleRoleId} as roleId,
               CONVERT(varchar(5), ${C.scheduleStart}, 108) as scheduleStart,
               CONVERT(varchar(5), ${C.scheduleEnd}, 108) as scheduleEnd
        FROM ${T.schedule}
        WHERE ${C.employeeId} = @employeeId
          AND ${C.scheduleDate} = @scheduleDate
      `);

    if (scheduleRows.recordset.length === 0) {
      await transaction.rollback();
      return res.status(409).json({ error: 'Selected slot is not available for this employee' });
    }

    const startMinutes = parseTimeToMinutes(time);
    const endMinutes = parseTimeToMinutes(formatTime(slotEndTime));

    const matchingSchedule = scheduleRows.recordset.find((row) => {
      const scheduleStartMinutes = parseTimeToMinutes(row.scheduleStart);
      const scheduleEndMinutes = parseTimeToMinutes(row.scheduleEnd);
      if (scheduleStartMinutes === null || scheduleEndMinutes === null || startMinutes === null || endMinutes === null) {
        return false;
      }
      return scheduleStartMinutes <= startMinutes && scheduleEndMinutes >= endMinutes;
    });

    if (!matchingSchedule) {
      await transaction.rollback();
      return res.status(409).json({ error: 'Selected slot is not available for this employee' });
    }

    const employeeRoleId = matchingSchedule.roleId || null;
    if (!employeeRoleId) {
      await transaction.rollback();
      return res.status(500).json({ error: 'Role not found for schedule' });
    }
    const groomerLevelCoefficient = GROOMER_LEVEL_COEFFICIENTS[employeeRoleId] || 1;

    const adjustedTotalPrice = normalizedServiceIds.reduce((sum, id) => {
      const basePrice = serviceBasePriceById.get(id);
      const safeBase = Number.isFinite(basePrice) ? basePrice : fallbackBasePrice;
      return sum + safeBase * sizeCoefficient * recencyCoefficient * groomerLevelCoefficient;
    }, 0);
    const clientOrderNote = buildClientOrderNote({ groomingRecency, clientComment });

    await new sql.Request(transaction)
      .input('orderId', sql.UniqueIdentifier, orderId)
      .input('price', sql.Numeric(10, 2), adjustedTotalPrice)
      .query(`
        UPDATE ${T.orders}
        SET ${C.orderPrice} = @price
        WHERE ${C.orderId} = @orderId
      `);

    const conflictResult = await new sql.Request(transaction)
      .input('employeeId', sql.UniqueIdentifier, employeeId)
      .input('startDateTime', sql.DateTime, orderDateTime)
      .input('endDateTime', sql.DateTime, slotEndTime)
      .query(`
        SELECT 1
        FROM ${T.orderServices}
        WHERE ${C.employeeId} = @employeeId
          AND ${C.orderStart} IS NOT NULL
          AND ${C.orderEnd} IS NOT NULL
          AND (${C.status} IS NULL OR ${C.status} NOT IN (N'Отменена', N'Отменён', N'Отменен'))
          AND ${C.orderStart} < @endDateTime
          AND ${C.orderEnd} > @startDateTime
      `);

    if (conflictResult.recordset.length > 0) {
      await transaction.rollback();
      return res.status(409).json({ error: 'Selected slot is already booked' });
    }

    const createServiceQuery = `
      INSERT INTO ${T.orderServices}
      (${C.orderId}, ${C.serviceId}, ${C.employeeId}, [ID_должности], ${C.orderStart}, ${C.orderEnd}, ${C.orderDuration}, ${C.note}, ${C.status}, ${C.servicePrice})
      VALUES (@orderId, @serviceId, @employeeId, @roleId, @startTime, @endTime, @duration, @note, @status, @price)
    `;

    let insertedServices = 0;
    for (const id of normalizedServiceIds) {
      const basePrice = serviceBasePriceById.get(id);
      const safeBase = Number.isFinite(basePrice) ? basePrice : fallbackBasePrice;
      const sizedPrice = safeBase * sizeCoefficient * recencyCoefficient * groomerLevelCoefficient;

      const insertResult = await new sql.Request(transaction)
        .input('orderId', sql.UniqueIdentifier, orderId)
        .input('serviceId', sql.UniqueIdentifier, id)
        .input('employeeId', sql.UniqueIdentifier, employeeId)
        .input('roleId', sql.UniqueIdentifier, employeeRoleId)
        .input('startTime', sql.DateTime, orderDateTime)
        .input('endTime', sql.DateTime, slotEndTime)
        .input('duration', sql.Int, serviceDurationById.get(id) || 60)
        .input('note', sql.NVarChar(sql.MAX), clientOrderNote || null)
        .input('status', sql.VarChar(20), '\u041d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u0430')
        .input('price', sql.Numeric(10, 2), sizedPrice)
        .query(createServiceQuery);
      insertedServices += insertResult?.rowsAffected?.[0] || 0;
    }

    if (insertedServices === 0) {
      await transaction.rollback();
      return res.status(500).json({ error: 'Failed to create order services' });
    }

    await transaction.commit();
    res.json({ success: true, orderId, totalPrice: adjustedTotalPrice });
  } catch (err) {
    if (transaction._aborted !== true) {
      try {
        await transaction.rollback();
      } catch (_rollbackError) {}
    }
    sendDbError(res, err, 'clients.orders.create');
  }
});

router.delete('/orders/:orderId', authenticateToken, checkRole(['client', 'admin', 'groomer']), async (req, res) => {
  try {
    await poolConnect;

    const orderId = req.params.orderId;
    const ownerId = req.user.userId;

    const orderCheck = await pool.request()
      .input('orderId', sql.UniqueIdentifier, orderId)
      .input('ownerId', sql.UniqueIdentifier, ownerId)
      .query(`
        SELECT 1
        FROM ${T.orders}
        WHERE ${C.orderId} = @orderId AND ${C.ownerId} = @ownerId
      `);

    if (orderCheck.recordset.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await pool.request()
      .input('orderId', sql.UniqueIdentifier, orderId)
      .query(`
        UPDATE ${T.orderServices}
        SET ${C.status} = N'\u041e\u0442\u043c\u0435\u043d\u0451\u043d'
        WHERE ${C.orderId} = @orderId
      `);

    res.json({ success: true, canceled: true });
  } catch (err) {
    sendDbError(res, err, 'clients.orders.delete');
  }
});

router.put('/profile', authenticateToken, checkRole(['client', 'admin', 'groomer']), async (req, res) => {
  try {
    const { fullName, phone } = req.body;

    await poolConnect;

    const query = `
      UPDATE ${T.owners}
      SET ${C.ownerName} = @fullName, ${C.ownerPhone} = @phone
      WHERE ${C.ownerId} = @userId
    `;

    await pool.request()
      .input('userId', sql.UniqueIdentifier, req.user.userId)
      .input('fullName', sql.VarChar(100), fullName)
      .input('phone', sql.VarChar(20), phone)
      .query(query);

    res.json({ success: true });
  } catch (err) {
    sendDbError(res, err, 'clients.profile.update');
  }
});

module.exports = router;
