/**
 * Product website API tests — testing real-world endpoints.
 * Created by Ankur Pratap — validates public APIs of popular products.
 */
import { APIUtil } from '../../../utils/APIUtil';

const api = new APIUtil();

describe('Real Product API Tests', () => {

  test('GitHub API: fetch public user profile', async () => {
    const response = await api.get<Record<string, any>>('https://api.github.com/users/ankurpratap93');
    api.assertStatus(response, 200);
    api.assertBodyKeys(response, ['login', 'id', 'avatar_url', 'public_repos']);
    api.saveResponse('github_user_profile', response);
    expect(response.body.login).toBe('ankurpratap93');
    console.log(`  ✓ GitHub: ${response.body.public_repos} public repos, response in ${response.duration}ms`);
  });

  test('JSONPlaceholder: fetch all users', async () => {
    const response = await api.get<any[]>('https://jsonplaceholder.typicode.com/users');
    api.assertStatus(response, 200);
    api.assertHeaders(response, ['content-type']);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(10);
    api.saveResponse('jsonplaceholder_all_users', response);
    console.log(`  ✓ JSONPlaceholder: ${response.body.length} users returned in ${response.duration}ms`);
  });

  test('FakeStore API: fetch product catalog', async () => {
    const response = await api.get<any[]>('https://fakestoreapi.com/products');
    api.assertStatus(response, 200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    const firstProduct = response.body[0];
    expect(firstProduct).toHaveProperty('title');
    expect(firstProduct).toHaveProperty('price');
    expect(firstProduct).toHaveProperty('category');
    expect(firstProduct).toHaveProperty('image');
    api.saveResponse('fakestore_products', response);
    console.log(`  ✓ FakeStore: ${response.body.length} products, first: "${firstProduct.title}" ($${firstProduct.price}), ${response.duration}ms`);
  });

  test('FakeStore API: fetch single product details', async () => {
    const response = await api.get<Record<string, any>>('https://fakestoreapi.com/products/1');
    api.assertAll(response, {
      expectedStatus: 200,
      requiredKeys: ['id', 'title', 'price', 'description', 'category', 'image', 'rating'],
    });
    expect(response.body.rating).toHaveProperty('rate');
    expect(response.body.rating).toHaveProperty('count');
    api.saveResponse('fakestore_product_1', response);
    console.log(`  ✓ Product #1: "${response.body.title}" - $${response.body.price} (${response.body.rating.rate}★, ${response.body.rating.count} reviews)`);
  });

  test('FakeStore API: fetch product categories', async () => {
    const response = await api.get<string[]>('https://fakestoreapi.com/products/categories');
    api.assertStatus(response, 200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    api.saveResponse('fakestore_categories', response);
    console.log(`  ✓ Categories: ${response.body.join(', ')}, ${response.duration}ms`);
  });

  test('DummyJSON API: fetch product list', async () => {
    const response = await api.get<Record<string, any>>('https://dummyjson.com/products?limit=5');
    api.assertStatus(response, 200);
    api.assertBodyKeys(response, ['products', 'total', 'skip', 'limit']);
    expect(response.body.products.length).toBe(5);
    api.saveResponse('dummyjson_products', response);
    console.log(`  ✓ DummyJSON: ${response.body.products.length} of ${response.body.total} products, first: "${response.body.products[0].title}", ${response.duration}ms`);
  });

  test('DummyJSON API: search products', async () => {
    const response = await api.get<Record<string, any>>('https://dummyjson.com/products/search?q=laptop');
    api.assertStatus(response, 200);
    api.assertBodyKeys(response, ['products', 'total']);
    expect(response.body.products.length).toBeGreaterThan(0);
    api.saveResponse('dummyjson_search_laptop', response);
    console.log(`  ✓ Search "laptop": found ${response.body.total} results, top: "${response.body.products[0]?.title}", ${response.duration}ms`);
  });

  test('K11 Software Solutions: homepage reachable', async () => {
    const start = Date.now();
    const res = await fetch('https://k11softwaresolutions.com', { method: 'HEAD' });
    const duration = Date.now() - start;
    expect(res.status).toBeLessThan(400);
    console.log(`  ✓ K11 homepage: status ${res.status}, ${duration}ms`);
  });
});
