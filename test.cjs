async function test() {
  const res = await fetch('http://localhost:3000/api/public/products');
  const data = await res.text();
  console.log('products', data);
  const res2 = await fetch('http://localhost:3000/api/public/pages');
  const data2 = await res2.text();
  console.log('pages', data2);
}

test();
