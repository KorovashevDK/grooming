const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../db');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/auth');

// Validate JWT_SECRET
if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET is not configured. Please set it in .env file.');
  process.exit(1);
}

// Phone validation regex (supports +7, +8, 8, and international formats)
const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const T_EMPLOYEES = '[dbo].[Сотрудники]';
const T_OWNERS = '[dbo].[Владельцы]';
const T_SCHEDULE = '[dbo].[Расписание_сотрудников]';
const C_EMPLOYEE_ID = '[Код_сотрудника]';
const C_OWNER_ID = '[Код_владельца]';
const C_ROLE_ID = '[ID_должности]';
const C_VK_ID = '[VK_ID]';
const C_EMPLOYEE_FULL_NAME = '[ФИО]';
const C_OWNER_FULL_NAME = '[Имя_Фамилия]';
const C_PHONE = '[Номер_телефона]';

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

const normalizePhone = (value) => String(value || '').replace(/\D/g, '');

const formatPhoneForStorage = (value) => {
  const digits = normalizePhone(value);
  if (!digits) {
    return '';
  }

  let normalized = digits;
  if (normalized.length === 11 && normalized.startsWith('8')) {
    normalized = `7${normalized.slice(1)}`;
  }

  if (normalized.length === 11 && normalized.startsWith('7')) {
    return `+7(${normalized.slice(1, 4)})${normalized.slice(4, 7)}-${normalized.slice(7, 9)}-${normalized.slice(9, 11)}`;
  }

  return value;
};

const formatOwnerName = (value) => {
  const parts = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 2) {
    return parts.join(' ');
  }

  if (parts.length >= 3) {
    return `${parts[1]} ${parts[0]}`;
  }

  return parts.join(' ');
};

const getEmployeesByVkId = async (vkId) => {
  const result = await pool.request()
    .input('vkId', sql.BigInt, vkId)
    .query(`
      SELECT s.*, s.${C_EMPLOYEE_ID} as employeeId, s.${C_VK_ID} as vkId, s.${C_EMPLOYEE_FULL_NAME} as fullName, s.${C_PHONE} as phone
      FROM ${T_EMPLOYEES} s
      WHERE s.${C_VK_ID} = @vkId
    `);
  return result.recordset || [];
};

const getOwnerByVkId = async (vkId) => {
  const result = await pool.request()
    .input('vkId', sql.BigInt, vkId)
    .query(`
      SELECT o.*, o.${C_OWNER_ID} as ownerId, o.${C_VK_ID} as vkId, o.${C_OWNER_FULL_NAME} as fullName, o.${C_PHONE} as phone
      FROM ${T_OWNERS} o
      WHERE o.${C_VK_ID} = @vkId
    `);
  return result.recordset[0] || null;
};

const updateOwnerPhoneIfMissing = async (ownerId, phone) => {
  if (!ownerId || !phone) {
    return;
  }

  const formattedPhone = formatPhoneForStorage(phone);

  await pool.request()
    .input('ownerId', sql.UniqueIdentifier, ownerId)
    .input('phone', sql.VarChar(20), formattedPhone)
    .query(`
      UPDATE ${T_OWNERS}
      SET ${C_PHONE} = CASE
        WHEN ${C_PHONE} IS NULL OR LTRIM(RTRIM(${C_PHONE})) = ''
        THEN @phone
        ELSE ${C_PHONE}
      END
      WHERE ${C_OWNER_ID} = @ownerId
    `);
};

const ensureClientOwner = async ({ vkId, fullName, phone }) => {
  const existingOwner = await getOwnerByVkId(vkId);

  if (existingOwner) {
    await updateOwnerPhoneIfMissing(existingOwner.ownerId, phone);
    return {
      ownerId: existingOwner.ownerId,
      fullName: existingOwner.fullName || fullName || '',
      phone: existingOwner.phone || formatPhoneForStorage(phone) || '',
    };
  }

  const ownerId = uuidv4();
  const formattedPhone = formatPhoneForStorage(phone);
  const ownerName = formatOwnerName(fullName) || 'Не указано';
  await pool.request()
    .input('id', sql.UniqueIdentifier, ownerId)
    .input('name', sql.VarChar(100), ownerName)
    .input('phone', sql.VarChar(20), formattedPhone)
    .input('vkId', sql.BigInt, vkId)
    .query(`
      INSERT INTO ${T_OWNERS}
      (${C_OWNER_ID}, ${C_OWNER_FULL_NAME}, ${C_PHONE}, ${C_VK_ID})
      VALUES (@id, @name, @phone, @vkId)
    `);

  return {
    ownerId,
    fullName: ownerName,
    phone: formattedPhone,
  };
};

const getOwnersByFullName = async (fullName) => {
  const result = await pool.request()
    .input('fullName', sql.VarChar(100), formatOwnerName(fullName))
    .query(`
      SELECT o.*, o.${C_OWNER_ID} as ownerId, o.${C_VK_ID} as vkId, o.${C_OWNER_FULL_NAME} as fullName, o.${C_PHONE} as phone
      FROM ${T_OWNERS} o
      WHERE o.${C_OWNER_FULL_NAME} = @fullName
    `);
  return result.recordset || [];
};

const findOfflineOwnerMatch = async (fullName, phone) => {
  if (!fullName || !phone) {
    return null;
  }

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return null;
  }

  const owners = await getOwnersByFullName(fullName);
  return owners.find((owner) => normalizePhone(owner.phone) === normalizedPhone) || null;
};

const getEmployeeRoleIdsBySchedule = async (employeeId) => {
  const result = await pool.request()
    .input('employeeId', sql.UniqueIdentifier, employeeId)
    .query(`
      SELECT DISTINCT r.${C_ROLE_ID} as roleId
      FROM ${T_SCHEDULE} r
      WHERE r.${C_EMPLOYEE_ID} = @employeeId
    `);
  return result.recordset.map((row) => row.roleId);
};

const getRoleIdsByVkId = async (vkId) => {
  const result = await pool.request()
    .input('vkId', sql.BigInt, vkId)
    .query(`
      SELECT DISTINCT sch.${C_ROLE_ID} as roleId
      FROM ${T_SCHEDULE} sch
      JOIN ${T_EMPLOYEES} s ON s.${C_EMPLOYEE_ID} = sch.${C_EMPLOYEE_ID}
      WHERE s.${C_VK_ID} = @vkId
    `);
  return result.recordset.map((row) => row.roleId);
};

const getEmployeeByVkIdAndRole = async (vkId, role) => {
  const roleIds = role === 'admin' ? ADMIN_ROLE_IDS : GROOMER_ROLE_IDS;
  const request = pool.request().input('vkId', sql.BigInt, vkId);
  roleIds.forEach((id, idx) => request.input(`roleId${idx}`, sql.UniqueIdentifier, id));

  const result = await request.query(`
    SELECT TOP 1 s.*, s.${C_EMPLOYEE_ID} as employeeId, s.${C_VK_ID} as vkId, s.${C_EMPLOYEE_FULL_NAME} as fullName, s.${C_PHONE} as phone
    FROM ${T_EMPLOYEES} s
    JOIN ${T_SCHEDULE} sch ON sch.${C_EMPLOYEE_ID} = s.${C_EMPLOYEE_ID}
    WHERE s.${C_VK_ID} = @vkId
      AND sch.${C_ROLE_ID} IN (${roleIds.map((_, idx) => `@roleId${idx}`).join(', ')})
  `);

  return result.recordset[0] || null;
};

const resolveRolesByIds = (roleIds = []) => {
  const roles = new Set();
  if (roleIds.some((id) => GROOMER_ROLE_IDS.includes(id))) {
    roles.add('groomer');
  }
  if (roleIds.some((id) => ADMIN_ROLE_IDS.includes(id))) {
    roles.add('admin');
  }
  return roles;
};

const buildAvailableRoles = (resolvedRoles) => {
  const roles = new Set(['client']);
  resolvedRoles.forEach((role) => roles.add(role));
  return Array.from(roles);
};

const getDefaultRole = (roles = []) => {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('groomer')) return 'groomer';
  return 'client';
};

const resolveRolesForEmployees = async (employees) => {
  const roles = new Set();
  for (const employee of employees) {
    const roleIds = await getEmployeeRoleIdsBySchedule(employee.employeeId);
    const resolved = resolveRolesByIds(roleIds);
    resolved.forEach((role) => roles.add(role));
  }
  return roles;
};

const findEmployeeForRole = async (employees, role) => {
  for (const employee of employees) {
    const roleIds = await getEmployeeRoleIdsBySchedule(employee.employeeId);
    const resolved = resolveRolesByIds(roleIds);
    if (resolved.has(role)) {
      return employee;
    }
  }
  return null;
};

// Validate token and return decoded auth payload
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

router.post('/discover', async (req, res) => {
  try {
    await poolConnect;
    const { vkId, fullName } = req.body || {};

    if (!vkId) {
      return res.status(400).json({ error: 'VK ID is required' });
    }

    const roleIds = await getRoleIdsByVkId(vkId);
    const resolved = resolveRolesByIds(roleIds);
    const owner = await getOwnerByVkId(vkId);

    if (resolved.size > 0) {
      const employees = await getEmployeesByVkId(vkId);
      const employee = employees[0] || null;
      const availableRoles = buildAvailableRoles(resolved);
      return res.json({
        status: 'employee_found',
        availableRoles,
        defaultRole: getDefaultRole(availableRoles),
        fullName: employee?.fullName || fullName || '',
        phoneMissingForClient: !owner || !owner.phone || String(owner.phone).trim() === '',
      });
    }

    if (owner) {
      return res.json({
        status: 'client_found',
        availableRoles: ['client'],
        defaultRole: 'client',
        fullName: owner.fullName || fullName || '',
        phoneMissing: !owner.phone || String(owner.phone).trim() === '',
      });
    }

    return res.json({
      status: 'needs_registration',
      availableRoles: ['client'],
      defaultRole: 'client',
      vkId,
      fullName: fullName || '',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to discover account', details: err.message });
  }
});

router.get('/roles', authenticateToken, async (req, res) => {
  try {
    await poolConnect;
    const vkId = req.user.vkId;

    const roles = new Set(['client']);
    const roleIds = await getRoleIdsByVkId(vkId);
    const resolved = resolveRolesByIds(roleIds);
    resolved.forEach((role) => roles.add(role));

    res.json({ roles: Array.from(roles) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve roles', details: err.message });
  }
});

router.post('/switch-role', authenticateToken, async (req, res) => {
  try {
    await poolConnect;
    const { role } = req.body || {};
    const vkId = req.user.vkId;

    if (!role || !['client', 'groomer', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const employees = await getEmployeesByVkId(vkId);
    const owner = await getOwnerByVkId(vkId);

    if (role === 'client') {
      const clientOwner = await ensureClientOwner({
        vkId,
        fullName: req.user.fullName || owner?.fullName || '',
        phone: req.user.phone || owner?.phone || '',
      });

      const token = jwt.sign(
        { userId: clientOwner.ownerId, vkId, role: 'client', fullName: clientOwner.fullName, phone: clientOwner.phone },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      return res.json({ role: 'client', token });
    }

    if (!employees.length) {
      return res.status(403).json({ error: 'Employee role is not available' });
    }

    const matchedEmployee = await getEmployeeByVkIdAndRole(vkId, role);
    if (!matchedEmployee) {
      return res.status(403).json({ error: 'Requested role is not available' });
    }

    const token = jwt.sign(
      { userId: matchedEmployee.employeeId, vkId: matchedEmployee.vkId, role, fullName: matchedEmployee.fullName || '', phone: matchedEmployee.phone || '' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({ role, token });
  } catch (err) {
    res.status(500).json({ error: 'Failed to switch role', details: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { vkId, fullName, phone, email } = req.body;

    // Validate required fields
    if (!vkId) {
      return res.status(400).json({ error: 'VK ID is required' });
    }

    // Validate phone if provided
    if (phone && !phoneRegex.test(phone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    // Validate email if provided
    if (email && !emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    await poolConnect;

    // 1) Сначала проверяем сотрудников и роли по расписанию
    const roleIds = await getRoleIdsByVkId(vkId);
    const resolved = resolveRolesByIds(roleIds);
    if (resolved.has('admin')) {
      const employee = await getEmployeeByVkIdAndRole(vkId, 'admin');
      if (employee) {
        if (phone) {
          await ensureClientOwner({
            vkId,
            fullName: employee.fullName || fullName || '',
            phone,
          });
        }
        const token = jwt.sign(
          { userId: employee.employeeId, vkId: employee.vkId, role: 'admin', fullName: employee.fullName || '', phone: formatPhoneForStorage(phone) || employee.phone || '' },
          process.env.JWT_SECRET,
          { expiresIn: '24h' }
        );
        return res.json({ role: 'admin', user: employee, token });
      }
    }
    if (resolved.has('groomer')) {
      const employee = await getEmployeeByVkIdAndRole(vkId, 'groomer');
      if (employee) {
        if (phone) {
          await ensureClientOwner({
            vkId,
            fullName: employee.fullName || fullName || '',
            phone,
          });
        }
        const token = jwt.sign(
          { userId: employee.employeeId, vkId: employee.vkId, role: 'groomer', fullName: employee.fullName || '', phone: formatPhoneForStorage(phone) || employee.phone || '' },
          process.env.JWT_SECRET,
          { expiresIn: '24h' }
        );
        return res.json({ role: 'groomer', user: employee, token });
      }
    }

    // 2) Затем проверяем владельцев
    const owner = await getOwnerByVkId(vkId);
    if (owner) {
      await updateOwnerPhoneIfMissing(owner.ownerId, phone);

      const token = jwt.sign(
        { userId: owner.ownerId, vkId: owner.vkId, role: 'client', fullName: owner.fullName || fullName || '', phone: owner.phone || phone || '' },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      return res.json({ role: 'client', user: owner, token });
    }

    // 3) Если VK_ID не найден, но телефона еще нет — просим завершить регистрацию
    if (!phone) {
      return res.status(200).json({
        needsRegistration: true,
        vkId,
        fullName: fullName || '',
      });
    }

    // 4) Пытаемся привязать офлайн-клиента по ФИО + телефону
    const matchedOfflineOwner = await findOfflineOwnerMatch(formatOwnerName(fullName), phone);
    if (matchedOfflineOwner) {
      await pool.request()
        .input('ownerId', sql.UniqueIdentifier, matchedOfflineOwner.ownerId)
        .input('vkId', sql.BigInt, vkId)
        .input('phone', sql.VarChar(20), formatPhoneForStorage(phone))
        .query(`
          UPDATE ${T_OWNERS}
          SET ${C_VK_ID} = @vkId,
              ${C_PHONE} = CASE
                WHEN ${C_PHONE} IS NULL OR LTRIM(RTRIM(${C_PHONE})) = ''
                THEN @phone
                ELSE ${C_PHONE}
              END
          WHERE ${C_OWNER_ID} = @ownerId
        `);

      const token = jwt.sign(
        { userId: matchedOfflineOwner.ownerId, vkId, role: 'client' },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        role: 'client',
        user: {
          ...matchedOfflineOwner,
          vkId,
        },
        token,
      });
    }

    // 5) Если совпадений нет — создаем нового владельца
    const newId = uuidv4();

    await pool.request()
      .input('id', sql.UniqueIdentifier, newId)
      .input('name', sql.VarChar(100), formatOwnerName(fullName) || 'Не указано')
      .input('phone', sql.VarChar(20), formatPhoneForStorage(phone) || '')
      .input('vkId', sql.BigInt, vkId)
      .query(`
        INSERT INTO ${T_OWNERS}
        (${C_OWNER_ID}, ${C_OWNER_FULL_NAME}, ${C_PHONE}, ${C_VK_ID})
        VALUES (@id, @name, @phone, @vkId)
      `);

    // Generate token for new user
    const token = jwt.sign(
      { userId: newId, vkId, role: 'client', fullName: formatOwnerName(fullName) || '', phone: formatPhoneForStorage(phone) || '' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ role: 'client', newUser: true, token });

  } catch (err) {
    console.error('Auth error:', err.message);
    res.status(500).json({ error: 'Authentication failed', details: err.message });
  }
});

module.exports = router;
