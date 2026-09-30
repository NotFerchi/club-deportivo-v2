const express = require('express');
const router = express.Router();
const sancionesController = require('../controllers/sancionesController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');
const { requirePositiveInt, validateBody } = require('../middleware/validators');

// POST /: socio (socioId o socio_id) y motivo obligatorios; sin body → errorHandler.
const datosSancion = validateBody({
  leer: (req) => {
    const { socioId, socio_id, motivo } = req.body;
    return { id: socioId || socio_id, motivo };
  },
  regla: ({ id, motivo }) => (!id || !motivo?.trim() ? [400, { error: 'Socio y motivo son obligatorios' }] : null),
  fnName: 'createSancion',
  mensaje: 'Error al crear sancion'
});

const socioIdValido = requirePositiveInt('socioId', { body: { error: 'socio_id debe ser un entero valido' } });

const adminRoles = ['admin', 'gerente'];
const staffRoles = ['admin', 'gerente', 'recepcion', 'coordinador', 'instructor'];
const writeRoles = ['admin', 'gerente', 'coordinador'];
const resolverRoles = ['admin', 'coordinador'];

router.get('/socio/:socioId', verifyToken, socioIdValido, sancionesController.getSancionesBySocio);
router.get('/socio/:socioId/verificar', verifyToken, socioIdValido, sancionesController.verificarSancionActiva);

router.get('/', verifyToken, checkRole(staffRoles), sancionesController.getSanciones);
router.get('/:id', verifyToken, checkRole(staffRoles), sancionesController.getSancionById);

router.post('/', verifyToken, checkRole(writeRoles), datosSancion, sancionesController.createSancion);
router.post('/no-shows/sincronizar', verifyToken, checkRole(adminRoles), sancionesController.sincronizarNoShows);
router.patch(
  '/:sancion_id',
  verifyToken,
  checkRole(resolverRoles),
  requirePositiveInt('sancion_id', { body: { error: 'sancion_id debe ser un entero valido' } }),
  sancionesController.resolverSancion
);
router.put('/:id', verifyToken, checkRole(writeRoles), sancionesController.updateSancion);
router.put('/:id/perdonar', verifyToken, checkRole(resolverRoles), sancionesController.perdonarSancion);
router.put('/:id/levantar', verifyToken, checkRole(resolverRoles), sancionesController.levantarSancion);
router.delete('/:id', verifyToken, checkRole(adminRoles), sancionesController.deleteSancion);

module.exports = router;
