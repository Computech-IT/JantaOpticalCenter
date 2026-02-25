const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'products.db');
const outputPath = path.join(__dirname, '..', 'mysql_dump.sql');

if (!fs.existsSync(dbPath)) {
    console.error('SQLite database not found at:', dbPath);
    process.exit(1);
}

const db = new sqlite3.Database(dbPath);

const tables = ['products', 'orders', 'admins'];

let sqlOutput = `-- Janta Optical Center MySQL Dump
-- Generated on ${new Date().toISOString()}

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

`;

// Schema creation
sqlOutput += `
--
-- Table structure for table \`products\`
--
DROP TABLE IF EXISTS \`products\`;
CREATE TABLE \`products\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`name\` varchar(255) NOT NULL,
  \`price\` int(11) NOT NULL,
  \`description\` text,
  \`img\` longtext,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Table structure for table \`orders\`
--
DROP TABLE IF EXISTS \`orders\`;
CREATE TABLE \`orders\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`customer_name\` varchar(255) NOT NULL,
  \`phone\` varchar(20) DEFAULT NULL,
  \`address\` text,
  \`notes\` text,
  \`items_json\` longtext,
  \`total\` int(11) DEFAULT 0,
  \`created_at\` datetime DEFAULT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Table structure for table \`admins\`
--
DROP TABLE IF EXISTS \`admins\`;
CREATE TABLE \`admins\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`username\` varchar(50) NOT NULL UNIQUE,
  \`password_hash\` varchar(255) NOT NULL,
  \`created_at\` datetime DEFAULT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

`;

db.serialize(() => {
    // Export Products
    db.all('SELECT * FROM products', (err, rows) => {
        if (err) throw err;
        if (rows.length > 0) {
            sqlOutput += `\n-- Dumping data for table \`products\`\nINSERT INTO \`products\` (\`id\`, \`name\`, \`price\`, \`description\`, \`img\`) VALUES\n`;
            const values = rows.map(r => `(${r.id}, '${escape(r.name)}', ${r.price}, '${escape(r.description)}', '${escape(r.img)}')`).join(',\n');
            sqlOutput += values + ';\n';
        }

        // Export Orders
        db.all('SELECT * FROM orders', (err, rows) => {
            if (err) throw err;
            if (rows.length > 0) {
                sqlOutput += `\n-- Dumping data for table \`orders\`\nINSERT INTO \`orders\` (\`id\`, \`customer_name\`, \`phone\`, \`address\`, \`notes\`, \`items_json\`, \`total\`, \`created_at\`) VALUES\n`;
                const values = rows.map(r => `(${r.id}, '${escape(r.customer_name)}', '${escape(r.phone)}', '${escape(r.address)}', '${escape(r.notes)}', '${escape(r.items_json)}', ${r.total}, '${r.created_at}')`).join(',\n');
                sqlOutput += values + ';\n';
            }

            // Export Admins
            db.all('SELECT * FROM admins', (err, rows) => {
                if (err) throw err;
                if (rows.length > 0) {
                    sqlOutput += `\n-- Dumping data for table \`admins\`\nINSERT INTO \`admins\` (\`id\`, \`username\`, \`password_hash\`, \`created_at\`) VALUES\n`;
                    const values = rows.map(r => `(${r.id}, '${escape(r.username)}', '${escape(r.password_hash)}', '${r.created_at}')`).join(',\n');
                    sqlOutput += values + ';\n';
                }

                sqlOutput += `\nSET FOREIGN_KEY_CHECKS = 1;`;
                fs.writeFileSync(outputPath, sqlOutput);
                console.log('MySQL dump created successfully at:', outputPath);
                db.close();
            });
        });
    });
});

function escape(str) {
    if (!str) return '';
    return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
        switch (char) {
            case "\0": return "\\0";
            case "\x08": return "\\b";
            case "\x09": return "\\t";
            case "\x1a": return "\\z";
            case "\n": return "\\n";
            case "\r": return "\\r";
            case "\"":
            case "'":
            case "\\":
            case "%":
                return "\\" + char; // prepends a backslash to backslash, percent, and double/single quotes
            default: return char;
        }
    });
}
