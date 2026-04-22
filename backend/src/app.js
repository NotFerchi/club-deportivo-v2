const app = require('./app');
const puerto = 3000;

app.listen(puerto, () => {
    console.log(`API activa en http://localhost:${puerto}`);
});