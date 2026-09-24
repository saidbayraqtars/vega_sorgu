/* Vega Köprü için SALT-OKUNUR SQL kullanıcısı (Vega Kılavuzu §43.5, §43.8)
   SSMS'te sa (veya sysadmin) ile çalıştırın. Şifreyi değiştirin.
   Köprü yalnız SELECT çalıştırır; db_datareader dışında hiçbir yetki vermeyin. */

DECLARE @sifre NVARCHAR(100) = N'BURAYA-GUCLU-BIR-SIFRE-YAZIN';
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'vega_kopru')
BEGIN
  DECLARE @sql NVARCHAR(MAX) = N'CREATE LOGIN [vega_kopru] WITH PASSWORD = N''' + REPLACE(@sifre, '''', '''''') +
                               N''', CHECK_POLICY = OFF, DEFAULT_DATABASE = [master];';
  EXEC sp_executesql @sql;
END
GO

USE [VEGADB];   -- veritabanı adınız farklıysa değiştirin
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'vega_kopru')
  CREATE USER [vega_kopru] FOR LOGIN [vega_kopru];
EXEC sp_addrolemember 'db_datareader', 'vega_kopru';   -- SQL Server 2008 uyumlu
GO
