const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../db');
const { v4: uuidv4 } = require('uuid');

router.post('/', async (req, res) => {
  try {
    const {
      petId,
      ownerId,
      serviceId,
      employeeId,
      date,
      price
    } = req.body;

    const orderId = uuidv4();

    await poolConnect;

    // 1️⃣ Создаем заказ
    await pool.request()
      .input('orderId', sql.UniqueIdentifier, orderId)
      .input('petId', sql.UniqueIdentifier, petId)
      .input('ownerId', sql.UniqueIdentifier, ownerId)
      .input('date', sql.DateTime, date)
      .input('price', sql.Numeric(10,2), price)
      .query(`
        INSERT INTO Заказ_груминг_услуг
        (Код_заказа, Код_груминг_клиента, Код_владельца, Дата_заказа, Стоимость_оказания_услуг)
        VALUES (@orderId, @petId, @ownerId, @date, @price)
      `);

    // 2️⃣ Добавляем оказание услуги
    await pool.request()
      .input('orderId', sql.UniqueIdentifier, orderId)
      .input('serviceId', sql.UniqueIdentifier, serviceId)
      .input('employeeId', sql.UniqueIdentifier, employeeId)
      .input('status', sql.VarChar(20), 'pending')
      .input('price', sql.Numeric(10,2), price)
      .query(`
        INSERT INTO Оказание_груминг_услуг
        (Код_заказа, Код_услуги, Код_сотрудника, ID_должности, Статус, Цена_за_услугу)
        VALUES (@orderId, @serviceId, @employeeId, NULL, @status, @price)
      `);

    res.json({ success: true, orderId });

  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;