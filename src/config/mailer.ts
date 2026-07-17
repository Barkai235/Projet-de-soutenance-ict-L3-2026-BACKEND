import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host:   process.env.MAIL_HOST   || 'smtp.gmail.com',
  port:   Number(process.env.MAIL_PORT) || 587,
  secure: process.env.MAIL_SECURE === 'true',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

export const verifyMailer = async (): Promise<void> => {
  try {
    await transporter.verify();
    console.log('✅ Service email opérationnel');
  } catch (error) {
    console.warn('⚠️  Service email non configuré (optionnel en dev) :', error);
  }
};

export default transporter;