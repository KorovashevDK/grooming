const { pool, poolConnect } = require('./db');
const sql = require('mssql');
const { v4: uuidv4 } = require('uuid');

async function addTestUsers() {
  try {
    await poolConnect;
    
    // Add test admin
    const adminId = uuidv4();
    await pool.request()
      .input('id', sql.UniqueIdentifier, adminId)
      .input('vkId', sql.BigInt, 987654321)
      .input('name', sql.VarChar(100), 'Тестовый Администратор')
      .input('phone', sql.VarChar(20), '+79999876543')
      .input('passport', sql.VarChar(50), '1234 567890')
      .query(`
        INSERT INTO Сотрудники (Код_сотрудника, VK_ID, ФИО, Номер_телефона, Паспортные_данные)
        VALUES (@id, @vkId, @name, @phone, @passport)
      `);
    console.log('✅ Test admin user added');
    
    // Add test groomer
    const groomerId = uuidv4();
    await pool.request()
      .input('id', sql.UniqueIdentifier, groomerId)
      .input('vkId', sql.BigInt, 555666777)
      .input('name', sql.VarChar(100), 'Тестовый Грумер')
      .input('phone', sql.VarChar(20), '+79995556667')
      .input('passport', sql.VarChar(50), '5678 123456')
      .query(`
        INSERT INTO Сотрудники (Код_сотрудника, VK_ID, ФИО, Номер_телефона, Паспортные_данные)
        VALUES (@id, @vkId, @name, @phone, @passport)
      `);
    console.log('✅ Test groomer user added');
    
    // Add test client
    const clientId = uuidv4();
    await pool.request()
      .input('id', sql.UniqueIdentifier, clientId)
      .input('vkId', sql.BigInt, 123456789)
      .input('name', sql.VarChar(100), 'Тестовый Клиент')
      .input('phone', sql.VarChar(20), '+79991234567')
      .query(`
        INSERT INTO Владельцы (Код_владельца, VK_ID, Имя_Фамилия, Номер_телефона)
        VALUES (@id, @vkId, @name, @phone)
      `);
    console.log('✅ Test client user added');
    
    console.log('\n🎉 All test users have been added successfully!');
    
  } catch (err) {
    console.error('Error adding test users:', err);
  } finally {
    await pool.close();
  }
}

addTestUsers();
