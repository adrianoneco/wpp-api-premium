const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WPPConnect API',
      version: '0.1.0',
      description: 'API para enviar mensagens via wppconnect-server',
    },
  },
  apis: ['./src/routes/*.js'],
};

const specs = swaggerJSDoc(options);

module.exports = { swaggerUi, specs };
