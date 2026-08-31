require('dotenv').config();

const { Client } = require('@notionhq/client');

if (!process.env.NOTION_TOKEN) {
  console.error('Missing NOTION_TOKEN. Add it to your .env file.');
  process.exit(1);
}

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function testConnection() {
  try {
    const me = await notion.users.me({});
    console.log('Connected to Notion.');
    console.log(`  Bot: ${me.name ?? '(unnamed)'}`);
    console.log(`  Type: ${me.type}`);
    console.log(`  ID: ${me.id}`);
    return me;
  } catch (error) {
    console.error('Notion connection failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  testConnection();
}

module.exports = { notion, testConnection };
