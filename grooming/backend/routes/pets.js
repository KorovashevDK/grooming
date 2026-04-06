const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../db');
const { authenticateToken, checkRole } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const T_PETS = '[\u0413\u0440\u0443\u043c\u0438\u043d\u0433_\u043a\u043b\u0438\u0435\u043d\u0442\u044b]';
const T_ORDERS = '[\u0417\u0430\u043a\u0430\u0437_\u0433\u0440\u0443\u043c\u0438\u043d\u0433_\u0443\u0441\u043b\u0443\u0433]';

const C_PET_ID = '[\u041a\u043e\u0434_\u0433\u0440\u0443\u043c\u0438\u043d\u0433_\u043a\u043b\u0438\u0435\u043d\u0442\u0430]';
const C_ORDER_OWNER_ID = '[\u041a\u043e\u0434_\u0432\u043b\u0430\u0434\u0435\u043b\u044c\u0446\u0430]';
const C_PET_OWNER_ID = '[\u041a\u043e\u0434_\u0432\u043b\u0430\u0434\u0435\u043b\u044c\u0446\u0430]';
const C_PET_NAME = '[\u041a\u043b\u0438\u0447\u043a\u0430]';
const C_PET_NAME_LEGACY = '[\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435_\u043f\u0438\u0442\u043e\u043c\u0446\u0430]';
const C_KIND = '[\u0412\u0438\u0434]';
const C_BREED = '[\u041f\u043e\u0440\u043e\u0434\u0430]';
const C_AGE = '[\u0412\u043e\u0437\u0440\u0430\u0441\u0442]';
const C_GENDER = '[\u041f\u043e\u043b]';
const C_NOTES = '[\u041e\u0441\u043e\u0431\u044b\u0435_\u043e\u0442\u043c\u0435\u0442\u043a\u0438]';
const C_SIZE = '[\u0420\u0430\u0437\u043c\u0435\u0440]';

const sendDbError = (res, err, context) =>
  res.status(500).json({ error: 'Database query failed', context, details: err.message });

const isSchemaError = (err) =>
  /Invalid column name|Invalid object name|could not be bound|Ambiguous column name/i.test(err?.message || '');

const normalizeSize = (value) => {
  if (!value) return '';
  const raw = String(value).trim().toLowerCase();
  if (['small', 's', '\u043c\u0430\u043b\u0435\u043d\u044c\u043a\u0438\u0439', '\u043c\u0430\u043b\u044b\u0439'].includes(raw)) return 'small';
  if (['medium', 'm', '\u0441\u0440\u0435\u0434\u043d\u0438\u0439'].includes(raw)) return 'medium';
  if (['large', 'l', '\u0431\u043e\u043b\u044c\u0448\u043e\u0439', '\u043a\u0440\u0443\u043f\u043d\u044b\u0439'].includes(raw)) return 'large';
  return '';
};

const normalizeGender = (value) => {
  if (value === null || value === undefined || value === '') {
    return { bit: null, label: '' };
  }

  if (typeof value === 'boolean') {
    return { bit: value ? 1 : 0, label: value ? 'male' : 'female' };
  }

  if (typeof value === 'number') {
    if (Number.isFinite(value)) {
      const bit = value ? 1 : 0;
      return { bit, label: bit ? 'male' : 'female' };
    }
  }

  const raw = String(value).trim().toLowerCase();
  if (['male', 'm', '\u0441\u0430\u043c\u0435\u0446', '\u043c\u0430\u043b\u044c\u0447\u0438\u043a', '\u043a\u043e\u0442', '\u043f\u0451\u0441', '\u043f\u0435\u0441'].includes(raw)) {
    return { bit: 1, label: 'male' };
  }
  if (['female', 'f', '\u0441\u0430\u043c\u043a\u0430', '\u0434\u0435\u0432\u043e\u0447\u043a\u0430', '\u043a\u043e\u0448\u043a\u0430', '\u0441\u0443\u043a\u0430'].includes(raw)) {
    return { bit: 0, label: 'female' };
  }

  return { bit: null, label: '' };
};

const mapPets = (rows) => {
  const petsMap = new Map();

  for (const row of rows) {
    const id = row.petId || row['\u041a\u043e\u0434_\u0433\u0440\u0443\u043c\u0438\u043d\u0433_\u043a\u043b\u0438\u0435\u043d\u0442\u0430'];
    if (!id || petsMap.has(id)) {
      continue;
    }

    petsMap.set(id, {
      id,
      name: row.petName || row['\u041a\u043b\u0438\u0447\u043a\u0430'] || row['\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435_\u043f\u0438\u0442\u043e\u043c\u0446\u0430'] || '\u041f\u0438\u0442\u043e\u043c\u0435\u0446',
      kind: row.petKind || row['\u0412\u0438\u0434'] || '',
      breed: row.petBreed || row['\u041f\u043e\u0440\u043e\u0434\u0430'] || '',
      age: row.petAge ?? row['\u0412\u043e\u0437\u0440\u0430\u0441\u0442'] ?? null,
      gender: normalizeGender(row.petGender ?? row['\u041f\u043e\u043b']).label || '',
      notes: row.petNotes || row['\u041e\u0441\u043e\u0431\u044b\u0435_\u043e\u0442\u043c\u0435\u0442\u043a\u0438'] || '',
      size: normalizeSize(row.petSize || row['\u0420\u0430\u0437\u043c\u0435\u0440'] || ''),
    });
  }

  return Array.from(petsMap.values());
};

const queryPetsByOrders = async (clientId) => {
  const query = `
    SELECT p.*
    FROM ${T_PETS} p
    JOIN ${T_ORDERS} o ON o.${C_PET_ID} = p.${C_PET_ID}
    WHERE o.${C_ORDER_OWNER_ID} = @clientId
  `;

  return pool.request().input('clientId', sql.UniqueIdentifier, clientId).query(query);
};

const queryPetsByOwnerLegacy = async (clientId) => {
  const query = `
    SELECT p.*
    FROM ${T_PETS} p
    WHERE p.${C_PET_OWNER_ID} = @clientId
  `;

  return pool.request().input('clientId', sql.UniqueIdentifier, clientId).query(query);
};

router.get('/my', authenticateToken, checkRole(['client', 'admin', 'groomer']), async (req, res) => {
  try {
    await poolConnect;
    const clientId = req.user.userId;

    let result;
    try {
      result = await queryPetsByOwnerLegacy(clientId);
    } catch (err) {
      if (!isSchemaError(err)) {
        throw err;
      }
      result = await queryPetsByOrders(clientId);
    }

    res.json(mapPets(result.recordset));
  } catch (err) {
    sendDbError(res, err, 'pets.my');
  }
});

router.get('/client/:clientId', authenticateToken, checkRole(['client', 'admin', 'groomer']), async (req, res) => {
  try {
    await poolConnect;
    const clientId = req.params.clientId;

    let result;
    try {
      result = await queryPetsByOwnerLegacy(clientId);
    } catch (err) {
      if (!isSchemaError(err)) {
        throw err;
      }
      result = await queryPetsByOrders(clientId);
    }

    res.json(mapPets(result.recordset));
  } catch (err) {
    sendDbError(res, err, 'pets.byClient');
  }
});

router.post('/', authenticateToken, checkRole(['client', 'admin', 'groomer']), async (req, res) => {
  try {
    const { petName, kind, breed, age, gender, notes, size } = req.body;
    if (!petName) {
      return res.status(400).json({ error: 'petName is required' });
    }

    await poolConnect;

    const queryWithOwnerAndSize = `
      INSERT INTO ${T_PETS}
      (${C_PET_ID}, ${C_PET_OWNER_ID}, ${C_PET_NAME}, ${C_KIND}, ${C_BREED}, ${C_AGE}, ${C_GENDER}, ${C_NOTES}, ${C_SIZE})
      VALUES (@petId, @ownerId, @petName, @kind, @breed, @age, @gender, @notes, @size)
    `;

    const queryWithOwner = `
      INSERT INTO ${T_PETS}
      (${C_PET_ID}, ${C_PET_OWNER_ID}, ${C_PET_NAME}, ${C_KIND}, ${C_BREED}, ${C_AGE}, ${C_GENDER}, ${C_NOTES})
      VALUES (@petId, @ownerId, @petName, @kind, @breed, @age, @gender, @notes)
    `;

    const queryLegacy = `
      INSERT INTO ${T_PETS}
      (${C_PET_ID}, ${C_PET_NAME}, ${C_KIND}, ${C_BREED}, ${C_AGE}, ${C_GENDER}, ${C_NOTES})
      VALUES (@petId, @petName, @kind, @breed, @age, @gender, @notes)
    `;

    const normalizedGender = normalizeGender(gender);

    const petId = uuidv4();
    const request = pool.request()
      .input('petId', sql.UniqueIdentifier, petId)
      .input('ownerId', sql.UniqueIdentifier, req.user.userId)
      .input('petName', sql.VarChar(100), petName)
      .input('kind', sql.VarChar(50), kind || '')
      .input('breed', sql.VarChar(100), breed || '')
      .input('age', sql.Int, Number.isFinite(Number(age)) ? Number(age) : null)
      .input('gender', sql.Bit, normalizedGender.bit)
      .input('notes', sql.Text, notes || '')
      .input('size', sql.VarChar(20), normalizeSize(size));

    try {
      await request.query(queryWithOwnerAndSize);
    } catch (err) {
      if (!isSchemaError(err)) {
        throw err;
      }
      try {
        await request.query(queryWithOwner);
      } catch (innerErr) {
        if (!isSchemaError(innerErr)) {
          throw innerErr;
        }
        await request.query(queryLegacy);
      }
    }

    res.json({ success: true, petId });
  } catch (err) {
    sendDbError(res, err, 'pets.create');
  }
});

router.put('/:petId', authenticateToken, checkRole(['client', 'admin', 'groomer']), async (req, res) => {
  try {
    const { petName, kind, breed, age, gender, notes, size } = req.body;
    if (!petName) {
      return res.status(400).json({ error: 'petName is required' });
    }

    await poolConnect;

    const queryWithOwnerAndSize = `
      UPDATE ${T_PETS}
      SET ${C_PET_NAME} = @petName,
          ${C_KIND} = @kind,
          ${C_BREED} = @breed,
          ${C_AGE} = @age,
          ${C_GENDER} = @gender,
          ${C_NOTES} = @notes,
          ${C_SIZE} = @size
      WHERE ${C_PET_ID} = @petId AND ${C_PET_OWNER_ID} = @ownerId
    `;

    const queryWithOwner = `
      UPDATE ${T_PETS}
      SET ${C_PET_NAME} = @petName,
          ${C_KIND} = @kind,
          ${C_BREED} = @breed,
          ${C_AGE} = @age,
          ${C_GENDER} = @gender,
          ${C_NOTES} = @notes
      WHERE ${C_PET_ID} = @petId AND ${C_PET_OWNER_ID} = @ownerId
    `;

    const queryLegacy = `
      UPDATE ${T_PETS}
      SET ${C_PET_NAME} = @petName,
          ${C_KIND} = @kind,
          ${C_BREED} = @breed,
          ${C_AGE} = @age,
          ${C_GENDER} = @gender,
          ${C_NOTES} = @notes
      WHERE ${C_PET_ID} = @petId
    `;

    const normalizedGender = normalizeGender(gender);

    const request = pool.request()
      .input('petId', sql.UniqueIdentifier, req.params.petId)
      .input('ownerId', sql.UniqueIdentifier, req.user.userId)
      .input('petName', sql.VarChar(100), petName)
      .input('kind', sql.VarChar(50), kind || '')
      .input('breed', sql.VarChar(100), breed || '')
      .input('age', sql.Int, Number.isFinite(Number(age)) ? Number(age) : null)
      .input('gender', sql.Bit, normalizedGender.bit)
      .input('notes', sql.Text, notes || '')
      .input('size', sql.VarChar(20), normalizeSize(size));

    try {
      const result = await request.query(queryWithOwnerAndSize);
      if (result.rowsAffected?.[0] > 0) {
        return res.json({ success: true });
      }
    } catch (err) {
      if (!isSchemaError(err)) {
        throw err;
      }
    }

    try {
      const result = await request.query(queryWithOwner);
      if (result.rowsAffected?.[0] > 0) {
        return res.json({ success: true });
      }
    } catch (err) {
      if (!isSchemaError(err)) {
        throw err;
      }
    }

    const legacyResult = await request.query(queryLegacy);
    if (legacyResult.rowsAffected?.[0] === 0) {
      return res.status(404).json({ error: 'Pet not found' });
    }

    res.json({ success: true });
  } catch (err) {
    sendDbError(res, err, 'pets.update');
  }
});

router.delete('/:petId', authenticateToken, checkRole(['client', 'admin', 'groomer']), async (req, res) => {
  try {
    await poolConnect;
    const queryWithOwner = `DELETE FROM ${T_PETS} WHERE ${C_PET_ID} = @petId AND ${C_PET_OWNER_ID} = @ownerId`;
    const queryLegacy = `DELETE FROM ${T_PETS} WHERE ${C_PET_ID} = @petId`;

    const request = pool.request()
      .input('petId', sql.UniqueIdentifier, req.params.petId)
      .input('ownerId', sql.UniqueIdentifier, req.user.userId);

    try {
      const result = await request.query(queryWithOwner);
      if (result.rowsAffected?.[0] > 0) {
        return res.json({ success: true });
      }
    } catch (err) {
      if (!isSchemaError(err)) {
        throw err;
      }
    }

    const legacyResult = await request.query(queryLegacy);
    if (legacyResult.rowsAffected?.[0] === 0) {
      return res.status(404).json({ error: 'Pet not found' });
    }

    res.json({ success: true });
  } catch (err) {
    sendDbError(res, err, 'pets.delete');
  }
});

module.exports = router;
