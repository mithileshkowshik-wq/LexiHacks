import dotenv from 'dotenv';

dotenv.config();

// Dynamic imports, not static ones - static `import` declarations are
// hoisted and evaluated before dotenv.config() above regardless of source
// order, which meant every module in this chain (recommendationEngine.js's
// module-scope singleton in particular) saw process.env before .env was
// actually loaded. See recommendationEngine.js's `engine-configured` log:
// it printed with mode "mock" and azureConfigured false even with a
// correct .env, because RECOMMENDATION_USE_MOCKS and the Azure vars were
// all undefined at the moment that singleton's constructor ran.
const [{ default: connectDB }, { default: app }] = await Promise.all([
  import('./config/dbConnection.js'),
  import('./app.js'),
]);

const port = process.env.PORT || 5000;

await connectDB();
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
