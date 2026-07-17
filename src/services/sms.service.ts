import pool from '../config/database';
import { RowDataPacket } from 'mysql2';

const SMS_USERNAME = process.env.AFRICAS_TALKING_USERNAME;
const SMS_API_KEY = process.env.AFRICAS_TALKING_API_KEY;
const SMS_SENDER = process.env.AFRICAS_TALKING_SENDER || undefined;

async function envoyerSMS(numero: string, message: string): Promise<void> {
  if (!SMS_USERNAME || !SMS_API_KEY) return;
  if (!numero) return;

  const params = new URLSearchParams({
    username: SMS_USERNAME,
    to: numero,
    message,
  });
  if (SMS_SENDER) params.append('from', SMS_SENDER);

  const response = await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: {
      apiKey: SMS_API_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Echec envoi SMS: HTTP ${response.status}`);
  }
}

export async function envoyerSMSAuPatient(patientId: number, message: string): Promise<void> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT telephone FROM utilisateurs WHERE id = ? LIMIT 1`,
    [patientId]
  );
  const telephone = rows[0]?.telephone ? String(rows[0].telephone) : '';
  if (!telephone) return;
  await envoyerSMS(telephone, message);
}

