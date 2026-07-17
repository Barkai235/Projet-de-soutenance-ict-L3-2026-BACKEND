import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface Medicament extends RowDataPacket {
  id:          number;
  nom:         string;
  dci:         string;
  classe:      string;
  forme:       string;
  dosage:      string;
  description: string;
  created_at:  string;
}

const MedicamentModel = {

  async findAll(search?: string): Promise<Medicament[]> {
    let query = `SELECT * FROM medicaments`;
    const params: string[] = [];

    if (search) {
      query += ` WHERE nom LIKE ? OR dci LIKE ? OR classe LIKE ?`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    query += ` ORDER BY classe, nom`;

    const [rows] = await pool.execute<Medicament[]>(query, params);
    return rows;
  },

  async findById(id: number): Promise<Medicament | null> {
    const [rows] = await pool.execute<Medicament[]>(
      `SELECT * FROM medicaments WHERE id = ?`, [id]
    );
    return rows[0] || null;
  },

  async create(data: {
    nom: string; dci?: string; classe?: string;
    forme?: string; dosage?: string; description?: string;
  }): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO medicaments (nom, dci, classe, forme, dosage, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.nom, data.dci ?? null, data.classe ?? null,
       data.forme ?? null, data.dosage ?? null, data.description ?? null]
    );
    return result.insertId;
  },

  async getClasses(): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT DISTINCT classe FROM medicaments WHERE classe IS NOT NULL ORDER BY classe`
    );
    return rows;
  },
};

export default MedicamentModel;