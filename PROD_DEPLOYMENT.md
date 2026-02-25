# Production Deployment Guide (Hostinger)

This guide explains how to migrate Janta Optical Center from local SQLite to Hostinger MySQL.

## 1. Local Data Export
I have created a script `scripts/export_to_mysql.js` that converts your local SQLite data into a MySQL-compatible `.sql` file.

**To generate the export:**
1. Open your terminal in the project root.
2. Run: `node scripts/export_to_mysql.js`
3. This will create a file named `mysql_dump.sql`.

## 2. Hostinger Database Setup
1. Log in to your Hostinger hPanel.
2. Go to **Databases** > **MySQL Databases**.
3. Create a new database and a user. **Save these credentials!**
4. Open **phpMyAdmin** for the new database.
5. Click the **Import** tab.
6. Choose the `mysql_dump.sql` file generated in Step 1.
7. Click **Go** to import your products, orders, and admin account.

## 3. Environment Variables
In Hostinger, you need to set up the following Environment Variables (usually found in the **Advanced** > **System Variables** or as part of your Node.js app configuration):

| Variable | Description |
|----------|-------------|
| `DB_HOST` | Usually `localhost` (check Hostinger DB info) |
| `DB_USER` | Your MySQL username |
| `DB_PASSWORD` | Your MySQL password |
| `DB_NAME` | Your MySQL database name |
| `JWT_SECRET` | A long random string for security |
| `PORT` | 3000 (standard for Node.js apps) |

## 4. Final Deployment
1. Upload your code to Hostinger (via Git or File Manager).
2. Run `npm install` in your Hostinger environment to install `mysql2` and other dependencies.
3. Start your app. The `server.js` automatically detects `DB_HOST` and switches to MySQL mode.

**Note:** The app will still use SQLite locally if you don't define these environment variables in your `.env` file.
