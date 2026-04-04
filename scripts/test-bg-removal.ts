// scripts/test-bg-removal.ts
// Run: npx tsx scripts/test-bg-removal.ts

async function testBgRemoval() {
  console.log('=== Background Removal Diagnostic ===');
  console.log('Platform:', process.platform);
  console.log('Arch:', process.arch);
  console.log('Node:', process.version);
  console.log('');

  // Test 1: Can we import the library?
  try {
    const { removeBackground } = await import('@imgly/background-removal-node');
    console.log('[OK] @imgly/background-removal-node imported');

    // Test 2: Create a test image via sharp
    const sharp = (await import('sharp')).default;
    const testBuffer = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
    }).png().toBuffer();
    console.log(`[OK] Test image created: ${testBuffer.length} bytes`);

    // Test 3: Run bg removal
    const uint8 = new Uint8Array(testBuffer);
    console.log('[..] Running removeBackground (this may download ONNX models on first run)...');
    const startTime = Date.now();
    const resultBlob = await removeBackground(uint8, {
      model: 'medium',
      output: { format: 'image/png', quality: 1 },
    });
    const elapsed = Date.now() - startTime;
    const resultBuffer = Buffer.from(await resultBlob.arrayBuffer());
    console.log(`[OK] BG removal succeeded in ${elapsed}ms, output: ${resultBuffer.length} bytes`);
    console.log('');
    console.log('STATUS: WORKING - @imgly/background-removal-node is functional');
  } catch (err) {
    console.error('[FAIL] BG removal error:', err instanceof Error ? err.message : err);
    if (err instanceof Error && err.stack) {
      console.error('Stack:', err.stack.split('\n').slice(0, 5).join('\n'));
    }
    console.log('');
    console.log('STATUS: BROKEN - sharp fallback will be used instead');

    // Test sharp fallback
    try {
      const sharp = (await import('sharp')).default;
      const testBuffer = await sharp({
        create: { width: 100, height: 100, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 255 } },
      }).png().toBuffer();
      const { data, info } = await sharp(testBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const pixels = new Uint8Array(data);
      let transparentCount = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] > 230 && pixels[i + 1] > 230 && pixels[i + 2] > 230) {
          pixels[i + 3] = 0;
          transparentCount++;
        }
      }
      console.log(`[OK] Sharp fallback works - made ${transparentCount} pixels transparent`);
    } catch (sharpErr) {
      console.error('[FAIL] Sharp fallback also broken:', sharpErr);
    }
  }
}

testBgRemoval();
