#!/usr/bin/env node
/**
 * Quick diagnostic to test if auth routes load without errors
 */
import authRouter from '../server/routes/auth.js';

console.log('✓ Auth router imported successfully');
console.log('Router type:', typeof authRouter);
console.log('Router stack:', authRouter?.stack?.length || 0, 'routes registered');

if (authRouter?.stack) {
  console.log('\nRegistered routes:');
  authRouter.stack.forEach(layer => {
    const route = layer.route;
    if (route) {
      const methods = Object.keys(route.methods).join(',').toUpperCase();
      console.log(`  ${methods} ${route.path}`);
    }
  });
}

console.log('\n✓ All checks passed. Auth routes should be available.');
