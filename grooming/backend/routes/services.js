const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../db');

const T_SERVICES = '[\u0413\u0440\u0443\u043c\u0438\u043d\u0433_\u0443\u0441\u043b\u0443\u0433\u0438]';
const C_SERVICE_ID = '[\u041a\u043e\u0434_\u0443\u0441\u043b\u0443\u0433\u0438]';
const C_SERVICE_NAME = '[\u041d\u0430\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u043d\u0438\u0435]';
const C_SERVICE_DESC = '[\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435]';
const C_SERVICE_PRICE = '[\u0411\u0430\u0437\u043e\u0432\u0430\u044f_\u0446\u0435\u043d\u0430]';
const C_SERVICE_DURATION = '[\u0414\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c_\u043c\u0438\u043d]';
const C_SERVICE_ANIMAL_TYPE = '[\u0422\u0438\u043f_\u0436\u0438\u0432\u043e\u0442\u043d\u043e\u0433\u043e]';

const sendDbError = (res, err, context) =>
  res.status(500).json({ error: 'Database query failed', context, details: err.message });

const isSchemaError = (err) =>
  /Invalid column name|Invalid object name|could not be bound|Ambiguous column name/i.test(err?.message || '');

const normalizeAnimalType = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  if (['dog', 'собака', 'собаки'].includes(raw)) return 'dog';
  if (['cat', 'кошка', 'кошки', 'кот'].includes(raw)) return 'cat';
  if (['all', 'any', 'все', 'любое'].includes(raw)) return 'all';
  return null;
};

router.get('/', async (_req, res) => {
  try {
    await poolConnect;
    const query = `SELECT * FROM ${T_SERVICES}`;
    const result = await pool.request().query(query);

    const getServicePrice = (row) => {
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

    const services = result.recordset.map((row) => ({
      id: row['\u041a\u043e\u0434_\u0443\u0441\u043b\u0443\u0433\u0438'],
      name: row['\u041d\u0430\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u043d\u0438\u0435'] || '\u0423\u0441\u043b\u0443\u0433\u0430',
      description: row['\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435'] || '',
      price: getServicePrice(row),
      animalType: normalizeAnimalType(row['\u0422\u0438\u043f_\u0436\u0438\u0432\u043e\u0442\u043d\u043e\u0433\u043e']) || 'all',
      durationMinutes: Number.isFinite(Number(row['\u0414\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c_\u043c\u0438\u043d']))
        ? Number(row['\u0414\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c_\u043c\u0438\u043d'])
        : 60,
    }))
      .sort((a, b) => {
        const priceA = Number(a.price);
        const priceB = Number(b.price);
        const safeA = Number.isFinite(priceA) ? priceA : -1;
        const safeB = Number.isFinite(priceB) ? priceB : -1;
        return safeB - safeA;
      });

    res.json(services);
  } catch (err) {
    sendDbError(res, err, 'services.list');
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description, price, durationMinutes, animalType } = req.body;
    await poolConnect;

    const queryWithPrice = `
      INSERT INTO ${T_SERVICES}
      (${C_SERVICE_ID}, ${C_SERVICE_NAME}, ${C_SERVICE_DESC}, ${C_SERVICE_PRICE}, ${C_SERVICE_DURATION}, ${C_SERVICE_ANIMAL_TYPE})
      VALUES (@id, @name, @desc, @price, @duration, @animalType)
    `;

    const queryWithPriceLegacyAnimalType = `
      INSERT INTO ${T_SERVICES}
      (${C_SERVICE_ID}, ${C_SERVICE_NAME}, ${C_SERVICE_DESC}, ${C_SERVICE_PRICE}, ${C_SERVICE_DURATION})
      VALUES (@id, @name, @desc, @price, @duration)
    `;

    const queryLegacy = `
      INSERT INTO ${T_SERVICES}
      (${C_SERVICE_ID}, ${C_SERVICE_NAME}, ${C_SERVICE_DESC})
      VALUES (@id, @name, @desc)
    `;

    const request = pool.request()
      .input('id', sql.UniqueIdentifier, require('uuid').v4())
      .input('name', sql.VarChar(100), name)
      .input('desc', sql.Text, description)
      .input('price', sql.Numeric(10, 2), Number.isFinite(Number(price)) ? Number(price) : 0)
      .input('animalType', sql.VarChar(20), normalizeAnimalType(animalType) || 'all')
      .input('duration', sql.Int, Number.isFinite(Number(durationMinutes)) ? Number(durationMinutes) : 60);

    try {
      await request.query(queryWithPrice);
    } catch (err) {
      if (!isSchemaError(err)) {
        throw err;
      }
      try {
        await request.query(queryWithPriceLegacyAnimalType);
      } catch (innerErr) {
        if (!isSchemaError(innerErr)) {
          throw innerErr;
        }
        await request.query(queryLegacy);
      }
    }

    res.json({ success: true });
  } catch (err) {
    sendDbError(res, err, 'services.create');
  }
});

module.exports = router;
