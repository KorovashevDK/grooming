const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../db');
const { authenticateToken, checkRole } = require('../middleware/auth');

const T = {
  employees: '[\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0438]',
  owners: '[\u0412\u043b\u0430\u0434\u0435\u043b\u044c\u0446\u044b]',
  pets: '[\u0413\u0440\u0443\u043c\u0438\u043d\u0433_\u043a\u043b\u0438\u0435\u043d\u0442\u044b]',
  orders: '[\u0417\u0430\u043a\u0430\u0437_\u0433\u0440\u0443\u043c\u0438\u043d\u0433_\u0443\u0441\u043b\u0443\u0433]',
  orderServices: '[\u041e\u043a\u0430\u0437\u0430\u043d\u0438\u0435_\u0433\u0440\u0443\u043c\u0438\u043d\u0433_\u0443\u0441\u043b\u0443\u0433]',
  services: '[\u0413\u0440\u0443\u043c\u0438\u043d\u0433_\u0443\u0441\u043b\u0443\u0433\u0438]',
  schedule: '[\u0420\u0430\u0441\u043f\u0438\u0441\u0430\u043d\u0438\u0435_\u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u043e\u0432]',
  roles: '[\u0414\u043e\u043b\u0436\u043d\u043e\u0441\u0442\u0438]',
};

const C = {
  employeeId: '[\u041a\u043e\u0434_\u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430]',
  employeeName: '[\u0424\u0418\u041e]',
  employeeVkId: '[VK_ID]',
  ownerId: '[\u041a\u043e\u0434_\u0432\u043b\u0430\u0434\u0435\u043b\u044c\u0446\u0430]',
  ownerName: '[\u0418\u043c\u044f_\u0424\u0430\u043c\u0438\u043b\u0438\u044f]',
  petId: '[\u041a\u043e\u0434_\u0433\u0440\u0443\u043c\u0438\u043d\u0433_\u043a\u043b\u0438\u0435\u043d\u0442\u0430]',
  petName: '[\u041a\u043b\u0438\u0447\u043a\u0430]',
  petKind: '[\u0412\u0438\u0434]',
  petBreed: '[\u041f\u043e\u0440\u043e\u0434\u0430]',
  petAge: '[\u0412\u043e\u0437\u0440\u0430\u0441\u0442]',
  petSize: '[\u0420\u0430\u0437\u043c\u0435\u0440]',
  orderId: '[\u041a\u043e\u0434_\u0437\u0430\u043a\u0430\u0437\u0430]',
  orderDate: '[\u0414\u0430\u0442\u0430_\u0437\u0430\u043a\u0430\u0437\u0430]',
  orderTotal: '[\u0421\u0442\u043e\u0438\u043c\u043e\u0441\u0442\u044c_\u043e\u043a\u0430\u0437\u0430\u043d\u0438\u044f_\u0443\u0441\u043b\u0443\u0433]',
  serviceId: '[\u041a\u043e\u0434_\u0443\u0441\u043b\u0443\u0433\u0438]',
  serviceName: '[\u041d\u0430\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u043d\u0438\u0435]',
  status: '[\u0421\u0442\u0430\u0442\u0443\u0441]',
  note: '[\u041f\u0440\u0438\u043c\u0435\u0447\u0430\u043d\u0438\u0435]',
  startWork: '[\u0412\u0440\u0435\u043c\u044f_\u043d\u0430\u0447\u0430\u043b\u0430_\u0440\u0430\u0431\u043e\u0442\u044b]',
  endWork: '[\u0412\u0440\u0435\u043c\u044f_\u043e\u043a\u043e\u043d\u0447\u0430\u043d\u0438\u044f_\u0440\u0430\u0431\u043e\u0442\u044b]',
  duration: '[\u0414\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c]',
  servicePrice: '[\u0426\u0435\u043d\u0430_\u0437\u0430_\u0443\u0441\u043b\u0443\u0433\u0443]',
  scheduleId: '[ID]',
  scheduleDate: '[\u0414\u0430\u0442\u0430]',
  scheduleStart: '[\u0412\u0440\u0435\u043c\u044f_\u043d\u0430\u0447\u0430\u043b\u0430]',
  scheduleEnd: '[\u0412\u0440\u0435\u043c\u044f_\u043e\u043a\u043e\u043d\u0447\u0430\u043d\u0438\u044f]',
  scheduleRoleId: '[ID_\u0434\u043e\u043b\u0436\u043d\u043e\u0441\u0442\u0438]',
};

const sendDbError = (res, err, context) =>
  res.status(500).json({ error: 'Database query failed', context, details: err.message });

const mergeMasterComment = (existingNote, masterComment) => {
  const source = String(existingNote || '').trim();
  const cleanComment = String(masterComment || '').trim();

  if (!cleanComment) {
    return source || null;
  }
  if (!source) {
    return `Комментарий мастера: ${cleanComment}`;
  }
  if (source.includes('Комментарий мастера:')) {
    return source.replace(/Комментарий мастера:\s*.*$/i, `Комментарий мастера: ${cleanComment}`);
  }
  return `${source}; Комментарий мастера: ${cleanComment}`;
};

router.get('/list', authenticateToken, checkRole(['client', 'admin']), async (_req, res) => {
  try {
    await poolConnect;
    const query = `SELECT * FROM ${T.employees}`;
    const employeesResult = await pool.request().query(query);

    const employees = employeesResult.recordset
      .map((row) => ({
        id: row['\u041a\u043e\u0434_\u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430'],
        fullName: row['\u0424\u0418\u041e'] || 'Сотрудник',
      }))
      .sort((a, b) => String(a.fullName).localeCompare(String(b.fullName), 'ru'));

    res.json(employees);
  } catch (err) {
    sendDbError(res, err, 'employees.list');
  }
});

router.get('/dashboard', authenticateToken, checkRole(['admin', 'groomer']), async (req, res) => {
  try {
    await poolConnect;

    const query = `
      SELECT o.${C.orderId} as orderId,
             o.${C.orderDate} as orderDate,
             o.${C.orderTotal} as orderTotal,
             cl.${C.ownerName} as clientName,
             pet.${C.petName} as petName,
             pet.${C.petKind} as petKind,
             pet.${C.petBreed} as petBreed,
             pet.${C.petAge} as petAge,
             pet.${C.petSize} as petSize,
             g.${C.serviceName} as serviceName,
             og.${C.status} as serviceStatus,
             og.${C.note} as note,
             og.${C.startWork} as startTime,
             og.${C.endWork} as endTime,
             og.${C.duration} as duration,
             og.${C.servicePrice} as servicePrice
      FROM ${T.orderServices} og
      JOIN ${T.orders} o ON og.${C.orderId} = o.${C.orderId}
      JOIN ${T.owners} cl ON o.${C.ownerId} = cl.${C.ownerId}
      JOIN ${T.pets} pet ON o.${C.petId} = pet.${C.petId}
      JOIN ${T.services} g ON og.${C.serviceId} = g.${C.serviceId}
      JOIN ${T.employees} s ON og.${C.employeeId} = s.${C.employeeId}
      WHERE s.${C.employeeVkId} = @vkId
      ORDER BY og.${C.startWork} DESC, o.${C.orderDate} DESC
    `;

    const assignedOrdersResult = await pool.request().input('vkId', sql.BigInt, req.user.vkId).query(query);
    res.json({ assignedOrders: assignedOrdersResult.recordset });
  } catch (err) {
    sendDbError(res, err, 'employees.dashboard');
  }
});

router.patch('/order/:orderId/status', authenticateToken, checkRole(['admin', 'groomer']), async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, note } = req.body || {};
    await poolConnect;

    const finalStatus = /completed|выполн/i.test(String(status || '')) ? 'Выполнено' : status;

    const currentNoteResult = await pool.request()
      .input('orderId', sql.UniqueIdentifier, orderId)
      .query(`
        SELECT TOP 1 ${C.note} as currentNote
        FROM ${T.orderServices}
        WHERE ${C.orderId} = @orderId
      `);

    const mergedNote = mergeMasterComment(currentNoteResult.recordset[0]?.currentNote, note);

    await pool.request()
      .input('orderId', sql.UniqueIdentifier, orderId)
      .input('status', sql.VarChar(20), finalStatus)
      .input('note', sql.NVarChar(sql.MAX), mergedNote)
      .query(`
        UPDATE ${T.orderServices}
        SET ${C.status} = @status,
            ${C.note} = @note
        WHERE ${C.orderId} = @orderId
      `);

    res.json({ success: true });
  } catch (err) {
    sendDbError(res, err, 'employees.order.updateStatus');
  }
});

const ROLE_IDS = {
  cashier: 'CAEBA1F4-A104-4C06-A398-20BECA42B0B0',
  admin: '88FCD70F-3EA6-400D-B233-647C30C4EA7E',
  assistantGroomer: 'A0261582-900D-42C5-9C4B-6D6F60C23A36',
  groomer: '882CB015-95ED-4C8E-B918-6E7C82606801',
  seniorGroomer: '5EEFB7DC-57E8-404B-94D0-B641D7F6D696',
  manager: 'DD19D48D-A2C4-4E3C-A762-EB125B31BB19',
};

const GROOMER_ROLE_IDS = [ROLE_IDS.groomer, ROLE_IDS.seniorGroomer, ROLE_IDS.assistantGroomer];
const ADMIN_ROLE_IDS = [ROLE_IDS.cashier, ROLE_IDS.admin, ROLE_IDS.manager];

const normalizeTime = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
  return null;
};

router.get('/schedule', authenticateToken, checkRole(['admin', 'groomer']), async (req, res) => {
  try {
    await poolConnect;
    const employeeId = req.user.userId;

    const result = await pool.request()
      .input('employeeId', sql.UniqueIdentifier, employeeId)
      .query(`
        SELECT sch.${C.scheduleId} as scheduleId,
               sch.${C.scheduleDate} as scheduleDate,
               CONVERT(varchar(5), sch.${C.scheduleStart}, 108) as scheduleStart,
               CONVERT(varchar(5), sch.${C.scheduleEnd}, 108) as scheduleEnd,
               sch.${C.scheduleRoleId} as roleId,
               role.[Наименование] as roleName
        FROM ${T.schedule} sch
        LEFT JOIN ${T.roles} role ON role.ID_должности = sch.${C.scheduleRoleId}
        WHERE sch.${C.employeeId} = @employeeId
        ORDER BY sch.${C.scheduleDate} DESC, sch.${C.scheduleStart} ASC
      `);

    res.json({ schedule: result.recordset });
  } catch (err) {
    sendDbError(res, err, 'employees.schedule.list');
  }
});

router.post('/schedule', authenticateToken, checkRole(['admin', 'groomer']), async (req, res) => {
  try {
    await poolConnect;
    const employeeId = req.user.userId;
    const { date, startTime, endTime, roleId } = req.body || {};

    if (!date || !startTime || !endTime) {
      return res.status(400).json({ error: 'date, startTime, endTime are required' });
    }

    const normalizedStart = normalizeTime(startTime);
    const normalizedEnd = normalizeTime(endTime);
    if (!normalizedStart || !normalizedEnd) {
      return res.status(400).json({ error: 'Invalid time format' });
    }

    const allowedRoleIds = req.user.role === 'admin'
      ? [...GROOMER_ROLE_IDS, ...ADMIN_ROLE_IDS]
      : GROOMER_ROLE_IDS;

    const finalRoleId = roleId || allowedRoleIds[0];
    if (!allowedRoleIds.includes(finalRoleId)) {
      return res.status(403).json({ error: 'Role is not allowed for schedule' });
    }

    const scheduleId = require('uuid').v4();

    await pool.request()
      .input('scheduleId', sql.UniqueIdentifier, scheduleId)
      .input('employeeId', sql.UniqueIdentifier, employeeId)
      .input('roleId', sql.UniqueIdentifier, finalRoleId)
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
    sendDbError(res, err, 'employees.schedule.create');
  }
});

router.patch('/schedule/:scheduleId', authenticateToken, checkRole(['admin', 'groomer']), async (req, res) => {
  try {
    await poolConnect;
    const employeeId = req.user.userId;
    const { scheduleId } = req.params;
    const { date, startTime, endTime, roleId } = req.body || {};

    if (!date || !startTime || !endTime) {
      return res.status(400).json({ error: 'date, startTime, endTime are required' });
    }

    const normalizedStart = normalizeTime(startTime);
    const normalizedEnd = normalizeTime(endTime);
    if (!normalizedStart || !normalizedEnd) {
      return res.status(400).json({ error: 'Invalid time format' });
    }

    const allowedRoleIds = req.user.role === 'admin'
      ? [...GROOMER_ROLE_IDS, ...ADMIN_ROLE_IDS]
      : GROOMER_ROLE_IDS;

    const finalRoleId = roleId || allowedRoleIds[0];
    if (!allowedRoleIds.includes(finalRoleId)) {
      return res.status(403).json({ error: 'Role is not allowed for schedule' });
    }

    await pool.request()
      .input('scheduleId', sql.UniqueIdentifier, scheduleId)
      .input('employeeId', sql.UniqueIdentifier, employeeId)
      .input('roleId', sql.UniqueIdentifier, finalRoleId)
      .input('date', sql.Date, date)
      .input('startTimeText', sql.VarChar(8), normalizedStart)
      .input('endTimeText', sql.VarChar(8), normalizedEnd)
      .query(`
        UPDATE ${T.schedule}
        SET ${C.scheduleRoleId} = @roleId,
            ${C.scheduleDate} = @date,
            ${C.scheduleStart} = CAST(@startTimeText AS time),
            ${C.scheduleEnd} = CAST(@endTimeText AS time)
        WHERE ${C.scheduleId} = @scheduleId AND ${C.employeeId} = @employeeId
      `);

    res.json({ success: true });
  } catch (err) {
    sendDbError(res, err, 'employees.schedule.update');
  }
});

router.delete('/schedule/:scheduleId', authenticateToken, checkRole(['admin', 'groomer']), async (req, res) => {
  try {
    await poolConnect;
    const employeeId = req.user.userId;
    const { scheduleId } = req.params;

    await pool.request()
      .input('scheduleId', sql.UniqueIdentifier, scheduleId)
      .input('employeeId', sql.UniqueIdentifier, employeeId)
      .query(`
        DELETE FROM ${T.schedule}
        WHERE ${C.scheduleId} = @scheduleId AND ${C.employeeId} = @employeeId
      `);

    res.json({ success: true });
  } catch (err) {
    sendDbError(res, err, 'employees.schedule.delete');
  }
});

module.exports = router;

