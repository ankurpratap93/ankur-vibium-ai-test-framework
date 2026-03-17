import { APIUtil } from '../../../utils/APIUtil';

const api = new APIUtil();

test('jsonplaceholder_get: should GET and validate response', async () => {
    const response = await api.get<Record<string, any>>('https://jsonplaceholder.typicode.com/posts/1');

    api.assertAll(response, {
        expectedStatus: 200,
        requiredKeys: ['userId', 'id', 'title', 'body'],
        requiredHeaders: ['content-type'],
    });

    api.saveResponse('get_jsonplaceholder', response);
});
