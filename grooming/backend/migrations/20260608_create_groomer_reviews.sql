IF OBJECT_ID(N'dbo.Отзывы_грумеров', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Отзывы_грумеров (
    Код_отзыва UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    Код_заказа UNIQUEIDENTIFIER NOT NULL UNIQUE,
    Код_сотрудника UNIQUEIDENTIFIER NOT NULL,
    Код_владельца UNIQUEIDENTIFIER NOT NULL,
    Рейтинг INT NOT NULL,
    Текст NVARCHAR(MAX) NULL,
    Дата_отзыва DATETIME2 NOT NULL CONSTRAINT DF_Отзывы_грумеров_Дата DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Отзывы_грумеров_Рейтинг CHECK (Рейтинг BETWEEN 1 AND 5)
  );

  CREATE INDEX IX_Отзывы_грумеров_Сотрудник
    ON dbo.Отзывы_грумеров (Код_сотрудника, Дата_отзыва DESC);
END;
