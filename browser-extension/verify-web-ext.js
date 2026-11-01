const { spawn } = require('child_process');

console.log('Executing: npx web-ext run');

// Use spawn to have better control over the process
const child = spawn('npx', ['web-ext', 'run'], { cwd: __dirname, shell: true });

child.stdout.on('data', (data) => console.log(`stdout: ${data}`));
child.stderr.on('data', (data) => console.log(`stderr: ${data}`));

// Set a timeout to kill the process after 5 seconds as requested
setTimeout(() => {
  console.log('Timeout reached (5000ms), terminating web-ext.');
  child.kill();
  process.exit(0);
}, 5000);

child.on('close', (code) => {
  if (code === 0 || code === null) {
      console.log('web-ext run finished successfully (or was terminated as expected).');
      process.exit(0);
  } else {
      console.log(`web-ext run closed with code ${code}`);
      process.exit(code);
  }
});
