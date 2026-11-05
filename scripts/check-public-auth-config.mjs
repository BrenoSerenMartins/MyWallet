// Docker builds must not publish a frontend whose auth configuration is empty.
const missing = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'].filter(
  (name) => !process.env[name]?.trim(),
);
if (missing.length) {
  console.error(
    `Missing public auth build configuration: ${missing.join(', ')}. Configure these environment variables on the hosting service, then rebuild.`,
  );
  process.exitCode = 1;
} else {
  console.log('Public auth build configuration is present.');
}
