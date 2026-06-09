IF COL_LENGTH(N'dbo.Владельцы', N'Согласие_ПДн_дата') IS NULL
BEGIN
  ALTER TABLE dbo.Владельцы
    ADD Согласие_ПДн_дата DATETIME2 NULL;
END;

IF COL_LENGTH(N'dbo.Владельцы', N'Согласие_ПДн_версия') IS NULL
BEGIN
  ALTER TABLE dbo.Владельцы
    ADD Согласие_ПДн_версия NVARCHAR(50) NULL;
END;
