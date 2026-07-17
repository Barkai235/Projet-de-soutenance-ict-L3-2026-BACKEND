import MedicamentModel from '../models/medicament.model';

const MedicamentService = {

  async lister(search?: string) {
    const medicaments = await MedicamentModel.findAll(search);
    const classes     = await MedicamentModel.getClasses();
    return { medicaments, classes: classes.map(c => c.classe) };
  },

  async detail(id: number) {
    const med = await MedicamentModel.findById(id);
    if (!med) throw new Error('Médicament introuvable');
    return med;
  },

  async creer(data: {
    nom: string; dci?: string; classe?: string;
    forme?: string; dosage?: string; description?: string;
  }) {
    const id = await MedicamentModel.create(data);
    return MedicamentModel.findById(id);
  },
};

export default MedicamentService;