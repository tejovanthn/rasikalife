// Test importing the tRPC router
try {
  const { artistRouter } = await import('../../trpc/src/routers/artist.js');
  console.log('tRPC router imported successfully');
  console.log('Router type:', typeof artistRouter);
} catch (error) {
  console.error('Error importing tRPC router:', error.message);
}

console.log('tRPC router imported successfully');
console.log('Router:', typeof artistRouter);
