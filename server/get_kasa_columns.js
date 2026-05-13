const { execSync } = require('child_process');
const sql = require('mssql');

async function run() {
  try {
    const pool = await sql.connect({
      user: 'sa', 
      password: '1', 
      server: 'localhost', 
      database: 'VEGADB', 
      options: {encrypt: false, trustServerCertificate: true}
    });
    
    const res = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'F0101D0003TBLKASA'");
    const columns = res.recordset.map(r => r.COLUMN_NAME + ' (' + r.DATA_TYPE + ')').join('\\n');
    
    require('fs').writeFileSync('C:\\\\Users\\\\saidb\\\\Desktop\\\\projeler\\\\vega_sorgu\\\\server\\\\kasa_columns.txt', columns);
    console.log("Columns written to kasa_columns.txt");
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
run();
