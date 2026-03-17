import { APIUtil } from '../../../utils/APIUtil';

const api = new APIUtil();

test('jsonplaceholder_post: should POST and validate response', async () => {
    const response = await api.post<Record<string, any>>('https://jsonplaceholder.typicode.com/posts', {
        title: 'Ankur Test Post',
        body: 'Testing the rebuilt API util',
        userId: 1,
    });

    api.assertAll(response, {
        expectedStatus: 201,
        requiredKeys: ['id', 'title', 'body', 'userId'],
        requiredHeaders: ['content-type'],
    });

    api.saveResponse('post_jsonplaceholder', response);
});
