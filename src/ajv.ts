import Ajv from 'ajv';

const ajv = new Ajv({
	strict: true,
});

export default ajv;
