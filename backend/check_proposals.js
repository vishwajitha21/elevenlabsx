import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { Proposal } from './models.js';

async function checkProposals() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const proposal = await Proposal.findOne().sort({ createdAt: -1 }).lean();
    if (proposal) {
      console.log('Last proposal steps:');
      proposal.steps.forEach(s => {
        console.log(`- ${s.label}: service="${s.service}"`);
      });
    } else {
      console.log('No proposals found');
    }
  } catch (err) {
    console.error(err.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkProposals();
