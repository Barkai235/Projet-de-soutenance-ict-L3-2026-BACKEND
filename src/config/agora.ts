import { RtcTokenBuilder, RtcRole } from 'agora-token';
import dotenv from 'dotenv';

dotenv.config();

const APP_ID          = process.env.AGORA_APP_ID          || '';
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || '';
const TOKEN_EXPIRY    = Number(process.env.AGORA_TOKEN_EXPIRY) || 3600;

export interface AgoraTokens {
  appId:         string;
  canal:         string;
  tokenPatient:  string;
  tokenMedecin:  string;
  expireAt:      number;
}

export const genererTokensAgora = (
  canal:      string,
  patientUid: number,
  medecinUid: number
): AgoraTokens => {

  if (!APP_ID || !APP_CERTIFICATE) {
    console.warn('⚠️  Agora non configure — tokens simules');
    const fakeToken = `fake_token_${Date.now()}`;
    return {
      appId:        APP_ID || 'demo_app_id',
      canal,
      tokenPatient: fakeToken,
      tokenMedecin: fakeToken,
      expireAt:     Math.floor(Date.now() / 1000) + TOKEN_EXPIRY,
    };
  }

  const expireAt = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY;

  const tokenPatient = RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    canal,
    patientUid,
    RtcRole.PUBLISHER,
    expireAt,
    expireAt
  );

  const tokenMedecin = RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    canal,
    medecinUid,
    RtcRole.PUBLISHER,
    expireAt,
    expireAt
  );

  return {
    appId: APP_ID,
    canal,
    tokenPatient,
    tokenMedecin,
    expireAt
  };
};

export const verifyAgora = (): void => {
  if (!APP_ID || !APP_CERTIFICATE) {
    console.warn('⚠️  Agora non configure (video desactivee)');
  } else {
    console.log('✅ Agora.io operationnel');
  }
};

export { APP_ID as AGORA_APP_ID };