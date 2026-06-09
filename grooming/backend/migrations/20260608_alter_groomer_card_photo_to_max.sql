IF OBJECT_ID(N'dbo.Карточки_грумеров', N'U') IS NOT NULL
BEGIN
  ALTER TABLE dbo.Карточки_грумеров
    ALTER COLUMN Фото_URL NVARCHAR(MAX) NULL;
END;
