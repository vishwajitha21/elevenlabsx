import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { AuditLog } from './models.js';

async function checkAudit() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(10).lean();
    console.log(JSON.stringify(logs, null, 2));
  } catch (err) {
    console.error(err.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkAudit();
