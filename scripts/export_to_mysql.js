const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'products.db');
const outputPath = path.join(__dirname, 'mysql_dump.sql');

if (!fs.existsSync(dbPath)) {
    console.error('❌ SQLite database not found at:', dbPath);
    process.exit(1);
}

console.log('🚀 Starting database migration...\n');

const db = new sqlite3.Database(dbPath);

let sqlOutput = `-- Janta Optical Center MySQL Database Dump
-- Generated on ${new Date().toISOString()}
-- All tables and data from SQLite database

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

`;

// Enhanced Table Structures
sqlOutput += `
--
-- Table structure for table \`products\`
--
DROP TABLE IF EXISTS \`products\`;
CREATE TABLE \`products\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`name\` varchar(255) NOT NULL,
  \`price\` decimal(10,2) NOT NULL,
  \`description\` longtext,
  \`img\` longtext COMMENT 'Comma-separated image filenames',
  \`created_at\` timestamp DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`name_idx\` (\`name\`),
  KEY \`created_at_idx\` (\`created_at\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table \`orders\`
--
DROP TABLE IF EXISTS \`orders\`;
CREATE TABLE \`orders\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`customer_name\` varchar(255) NOT NULL,
  \`customer_email\` varchar(255),
  \`customer_phone\` varchar(20),
  \`phone\` varchar(20) COMMENT 'Alternative phone field',
  \`address\` longtext,
  \`notes\` longtext,
  \`items_json\` longtext COMMENT 'JSON array of cart items',
  \`items_count\` int(11) DEFAULT 1,
  \`total\` decimal(10,2) DEFAULT 0,
  \`status\` varchar(50) DEFAULT 'pending' COMMENT 'pending, processing, completed, cancelled',
  \`created_at\` timestamp DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`customer_phone_idx\` (\`customer_phone\`),
  KEY \`status_idx\` (\`status\`),
  KEY \`created_at_idx\` (\`created_at\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table \`admins\`
--
DROP TABLE IF EXISTS \`admins\`;
CREATE TABLE \`admins\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`username\` varchar(50) NOT NULL UNIQUE,
  \`password_hash\` varchar(255) NOT NULL,
  \`email\` varchar(255),
  \`role\` varchar(50) DEFAULT 'admin',
  \`created_at\` timestamp DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`username_unique\` (\`username\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

`;

// Fetch all tables from SQLite
db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", (err, tables) => {
    if (err) {
        console.error('❌ Error fetching tables:', err);
        db.close();
        process.exit(1);
    }

    const tableNames = tables.map(t => t.name);
    console.log('📊 Found tables:', tableNames.join(', '));
    console.log('');

    let processedTables = 0;
    const totalTables = tableNames.length;

    if (totalTables === 0) {
        console.error('❌ No tables found in database!');
        db.close();
        process.exit(1);
    }

    tableNames.forEach(tableName => {
        // Get table schema
        db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
            if (err) {
                console.error(`❌ Error getting schema for ${tableName}:`, err);
                return;
            }

            // Get all data
            db.all(`SELECT * FROM ${tableName}`, (err, rows) => {
                if (err) {
                    console.error(`❌ Error exporting ${tableName}:`, err);
                    return;
                }

                console.log(`✅ Processing ${tableName} - ${rows.length} rows`);

                if (rows.length > 0) {
                    sqlOutput += `\n--\n-- Dumping data for table \`${tableName}\`\n--\n`;

                    const columnNames = columns.map(c => `\`${c.name}\``).join(', ');
                    sqlOutput += `INSERT INTO \`${tableName}\` (${columnNames}) VALUES\n`;

                    const values = rows.map((row, index) => {
                        const rowValues = columns.map(col => {
                            const value = row[col.name];

                            if (value === null || value === undefined) {
                                return 'NULL';
                            }

                            // Handle numeric types
                            if (col.type.includes('INT') || col.type.includes('DECIMAL') || col.type.includes('NUMERIC') || col.type.includes('REAL')) {
                                return value.toString();
                            }

                            // Handle datetime
                            if (col.type.includes('DATETIME') || col.type.includes('TIMESTAMP')) {
                                if (value === '' || value === null) {
                                    return 'NULL';
                                }
                                return `'${value}'`;
                            }

                            // Handle text/string values
                            const escaped = escapeSQL(value.toString());
                            return `'${escaped}'`;
                        }).join(', ');

                        return `(${rowValues})`;
                    }).join(',\n');

                    sqlOutput += values + ';\n';
                } else {
                    sqlOutput += `\n-- Table \`${tableName}\` is empty\n`;
                }

                processedTables++;

                // When all tables are processed, write to file
                if (processedTables === totalTables) {
                    sqlOutput += `\n--\n-- Final checks\n--\nSET FOREIGN_KEY_CHECKS = 1;\n`;

                    fs.writeFileSync(outputPath, sqlOutput);

                    console.log('\n' + '='.repeat(60));
                    console.log('✅ MYSQL DUMP CREATED SUCCESSFULLY!');
                    console.log('='.repeat(60));
                    console.log('📁 File Location:', outputPath);
                    console.log('📊 Tables Exported:', tableNames.join(', '));
                    console.log('💾 File Size:', (sqlOutput.length / 1024).toFixed(2), 'KB');
                    console.log('');
                    console.log('📝 HOSTINGER IMPORT INSTRUCTIONS:');
                    console.log('---');
                    console.log('1. Go to Hostinger Dashboard');
                    console.log('2. Navigate to: Hosting > MySQL Databases');
                    console.log('3. Click on your database name');
                    console.log('4. Click "phpMyAdmin"');
                    console.log('5. Select your database from left sidebar');
                    console.log('6. Click "Import" tab at top');
                    console.log('7. Click "Choose File" and select mysql_dump.sql');
                    console.log('8. Scroll down and click "Import" button');
                    console.log('---');
                    console.log('✨ Your database will be ready to use!');
                    console.log('');

                    db.close();
                }
            });
        });
    });
});

/**
 * Escape special characters for MySQL SQL
 */
function escapeSQL(str) {
    if (!str) return '';

    return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
        switch (char) {
            case "\0": return "\\0";
            case "\x08": return "\\b";
            case "\x09": return "\\t";
            case "\x1a": return "\\z";
            case "\n": return "\\n";
            case "\r": return "\\r";
            case "\"": return "\\\"";
            case "'": return "\\'";
            case "\\": return "\\\\";
            case "%": return "\\%";
            default: return char;
        }
    });
}