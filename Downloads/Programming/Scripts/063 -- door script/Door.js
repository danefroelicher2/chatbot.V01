
// #region MAIN PROCESSING PIPELINE

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getUPCSplittingConfig(targetDoc) {
    try {
        const pog = targetDoc.data.planogram;
        const desc13Value = pog.data.desc.get(13);

        if (!desc13Value || desc13Value.toString().trim() === '') {
            console.log("📋 DESC 13: Empty - defaulting to YES (ALLOW) UPC splitting");
            return true;
        }

        const normalizedValue = desc13Value.toString().trim().toLowerCase();

        if (normalizedValue === 'yes') {
            console.log("✅ DESC 13: YES - UPC splitting ENABLED");
            return true;
        } else if (normalizedValue === 'no') {
            console.log("🚫 DESC 13: NO - UPC splitting DISABLED");
            return false;
        } else {
            console.log(`⚠️ DESC 13: Invalid value "${desc13Value}" - defaulting to NO UPC splitting`);
            return false;
        }

    } catch (error) {
        console.log(`❌ Error reading DESC 13: ${error.message} - defaulting to NO UPC splitting`);
        return false;
    }
}

let _desc13ConfigCache = null;

function getCachedUPCSplittingConfig(targetDoc) {
    // Only recalculate if cache is empty or document changed
    if (!_desc13ConfigCache || _desc13ConfigCache.docId !== targetDoc.id) {
        _desc13ConfigCache = {
            docId: targetDoc.id,
            allowUPCSplitting: getUPCSplittingConfig(targetDoc)
        };
    }

    return _desc13ConfigCache.allowUPCSplitting;
}

function clearUPCSplittingConfigCache() {
    _desc13ConfigCache = null;
    console.log("🔄 DESC 13 configuration cache cleared");
}

async function getOrCreateFolder(parentFolderUuid, name) {
    let folder = (await VqUtils.getFilesInFolder(parentFolderUuid)).find(f => f.name === name);
    if (!folder) {
        folder = await VqUtils.createFolder(parentFolderUuid, name);
    }
    return folder;
}

async function loadDoc(targetFileUuid) {
    const targetFile = await VqUtils.getFile(targetFileUuid);
    const blob = await VqUtils.getBlob(targetFile);
    const doc = await RplanUtils.process(blob, targetFile);
    await RplanUtils.sleep(1000);
    if (!doc) return null;
    return doc;
}

async function runHeadless(args) {
    console.log("🎯 MERCHANDISING SETTINGS BATCH AUTOMATION STARTED");

    try {
        let file = await VqUtils.getFile(args.targetUuid);

        if (file.fileType === "file") {
            let folder = await VqUtils.getFile(file.folderUuid);
            let parentFolder = await VqUtils.getFile(folder.folderUuid);
            let outputFolder = await getOrCreateFolder(parentFolder.uuid, `${folder.name} - Test 2`);

            console.log(`📁 Loading target file: ${file.name}...`);
            let targetDoc = await loadDoc(file.uuid);

            if (!targetDoc) {
                console.log("❌ Failed to load document");
                return;
            }

            await sleep(100);

            let textBoxes = targetDoc.data.planogram.annotations;
            let projectTextBoxCounter = textBoxes.reduce((total, item) =>
                total + (item.text.includes("STOP") || item.text.includes("Stop") || item.text.includes("stop") ? 1 : 0), 0
            );

            if (Number(projectTextBoxCounter) === 0) {
                console.log("📄 Processing merchandising settings...");

                const results = await processDocument(targetDoc);

                console.log(`📊 Processing Results:`);
                console.log(`   ✅ Products updated: ${results.processedProducts}`);
                console.log(`   ✅ Fixtures updated: ${results.processedFixtures}`);
                console.log(`   🚨 Products overlapping segments: ${results.overlappingProducts}`);

                console.log("💾 Saving processed file...");
                let outputBlob = await RplanUtils.export(targetDoc, "psa");

                if (targetDoc.data.planogram.data.desc.get(50) === "OVER-ALLOCATED") {
                    await VqUtils.createFile(
                        file.name.replace(".psa", " - OVERALLOCATED") + ".psa",
                        outputFolder.uuid,
                        outputBlob,
                        true
                    );
                } else {
                    targetDoc.data.planogram.data.desc.set(50, "PROCESSED");
                    await VqUtils.createFile(file.name, outputFolder.uuid, outputBlob, true);
                }

                console.log("✅ File processed and saved successfully!");
            } else {
                console.log("⭐ Project POG detected (contains STOP) - skipping processing");
            }
        }
    } catch (error) {
        console.log(`❌ Error processing file: ${error.message}`);
        console.error(error);
    }

    console.log("🏁 MERCHANDISING SETTINGS BATCH AUTOMATION COMPLETE");
}

async function processDocument(targetDoc) {
    console.log("🚀 Starting merchandising settings update...");

    const pog = targetDoc.data.planogram;

    // Initialize DESC 13 configuration at the start of processing
    console.log("\n" + "=".repeat(80));
    console.log("⚙️ READING DESC 13 CONFIGURATION");
    const allowUPCSplitting = getCachedUPCSplittingConfig(targetDoc);
    console.log("=".repeat(80) + "\n");

    // Store configuration in targetDoc for easy access throughout processing
    targetDoc._allowUPCSplitting = allowUPCSplitting;
    const positions = Array.from(pog.positions);
    const fixtures = Array.from(pog.fixtures);

    console.log(`📊 Planogram info:`);
    console.log(`   • Total positions: ${positions.length}`);
    console.log(`   • Total fixtures: ${fixtures.length}`);
    console.log(`   • Planogram name: ${pog.name}`);

    console.log("\n" + "=".repeat(80));
    console.log("🔄 NORMALIZING FIXTURE DIRECTIONS (Forcing Left-to-Right)");

    let reversedFixtureCount = 0;
    let normalFixtureCount = 0;

    for (let fixture of fixtures) {
        const currentDirection = fixture.merch.x.direction.value;

        // Check current direction: 0 = Normal (left-to-right), 1 = Reverse (right-to-left)
        if (currentDirection !== 0) {
            fixture.merch.x.direction.value = 0;  // Force to Normal
            reversedFixtureCount++;
        } else {
            normalFixtureCount++;
        }
    }

    console.log(`\n📊 Direction Normalization Summary:`);
    console.log(`   ✅ Already Normal: ${normalFixtureCount} fixtures`);
    console.log(`   🔄 Converted to Normal: ${reversedFixtureCount} fixtures`);
    console.log(`   🎯 Total fixtures processed: ${fixtures.length}`);

    if (reversedFixtureCount > 0) {
        console.log(`\n⚠️  REVERSE FLOW PLANOGRAM DETECTED - ${reversedFixtureCount} fixtures normalized`);
        console.log(`   🔧 Updating planogram to apply direction changes...`);
        pog.updateNodes();
        await sleep(200);  // Give extra time for reverse flow corrections
        console.log(`   ✅ Direction changes applied successfully`);
    } else {
        console.log(`   ℹ️  Planogram was already in Normal (left-to-right) flow`);
    }

    console.log("=".repeat(80) + "\n");

    // Log complete planogram positioning BEFORE any changes
    console.log("\n" + "=".repeat(80));
    console.log("📋 INITIAL PRODUCT POSITIONING - BEFORE ANY CHANGES");
    const beforeSnapshot = logSegmentProducts(targetDoc, { captureData: true, detailLevel: 'summary' }); targetDoc._originalProductSnapshot = beforeSnapshot; // Store for later comparison
    console.log("=".repeat(80) + "\n");

    // Capture last segment snapshot BEFORE any changes
    console.log("\n" + "=".repeat(80));
    console.log("📸 BEFORE SNAPSHOT: Last Segment Products");
    const lastSegmentSnapshot = captureLastSegmentProducts(targetDoc);
    console.log("=".repeat(80) + "\n");

    // PHASE 1: Update product merchandising settings
    console.log("⚙️ Updating product merchandising settings...");
    let processedProducts = 0;

    for (let pos of positions) {
        pos.merch.x.size.value = 1;        // Stack products
        pos.merch.x.placement.value = 3;   // Left align products
        pos.merchStyle = 0;                // Unit merchandising style
        processedProducts++;
        pos.merch.y.max.value = pos.facings.y

    }

    console.log(`✅ Updated merchandising settings for ${processedProducts} products`);

    // PHASE 2: Update fixture combine settings
    let processedFixtures = 0;

    for (let fixture of fixtures) {
        fixture.canCombine = 1;  // Allow fixtures to combine initially
        processedFixtures++;
    }

    console.log(`✅ Updated canCombine for ${processedFixtures} fixtures`);
    console.log(`   • All fixtures canCombine: 1 (yes)`);

    // PHASE 3: Apply changes and identify overlaps
    pog.updateNodes();
    await sleep(100);

    // PHASE 4: Identify and resolve segment overlaps
    console.log("\n" + "=".repeat(60));
    const overlappingProducts = identifySegmentOverlaps(targetDoc);
    console.log("=".repeat(60) + "\n");

    // PHASE 5: Lock first segment and process all segment breaks
await setSegmentCanCombineNo(targetDoc, null, null);
    pog.updateNodes();
    await sleep(100);

    // PHASE 6: Sequential segment break processing
    await processAllSegmentBreaks(targetDoc);
    // PHASE 7: Facing inflation for last two segments
    await inflateFacingsInLastTwoSegments(targetDoc);

    // Verify last segment products AFTER all processing
    console.log("\n" + "=".repeat(80));
    console.log("🔍 AFTER VERIFICATION: Last Segment Products");
    await verifyLastSegmentProducts(targetDoc, lastSegmentSnapshot);
    console.log("=".repeat(80) + "\n");

    // PHASE 8: Fill remaining space in last segment
    await fillRemainingSpaceInLastSegment(targetDoc);

    // PHASE 9: Process split UPCs based on desc 13 configuration (FINAL STEP)
    await processSplitUPCsBasedOnDesc13(targetDoc);

    return {
        processedProducts: processedProducts,
        processedFixtures: processedFixtures,
        overlappingProducts: overlappingProducts.length
    };
}

// #endregion

// #region LAST SEGMENT TRACKING

// Unified logging function 
// Mode 1 (ALL): can print every segment, fixture, product, etc. (unused in prod, useful for debugging)
// Mode 2 (TWO): Used to detect displacement of prods between two segments (used in processAllSegmentBreaks)
// Mode 3 (COMPLETE): Creates original snapshot of prods -------------- redundant with ALL; fix!!
function logSegmentProducts(targetDoc, options = {}) {
    const {
        mode = 'all',
        segmentIndices = [],
        captureData = false,
        detailLevel = 'full'
    } = options;

    const pog = targetDoc.data.planogram;
    const segments = Array.from(pog.segments).sort((a, b) => a.uiX - b.uiX);
    const allPositions = Array.from(pog.positions);
    const allFixtures = Array.from(pog.fixtures);

    // Handle empty segments case
    if (segments.length === 0) {
        if (detailLevel === 'full') {
            console.log("⚠️ No segments found in planogram");
            return { segments: [] };
        } else {
            console.log("⚠️ No segments found in planogram");
            return captureData ? {} : undefined;
        }
    }

    // Determine which segments to process
    let segmentsToProcess;
    if (mode === 'two') {
        segmentsToProcess = segmentIndices.map(idx => ({ segment: segments[idx], index: idx }));
    } else {
        segmentsToProcess = segments.map((seg, idx) => ({ segment: seg, index: idx }));
    }

    // Initialize return data structures
    const segmentData = [];
    const capturedData = {};

    // Header for 'all' mode
    if (detailLevel === 'full') {
        console.log("🔍 Capturing complete product inventory across all segments...\n");
        console.log(`📊 Found ${segments.length} segments to catalog\n`);
    }

    // Process each segment
    segmentsToProcess.forEach(({ segment, index: segmentIndex }) => {
        const segmentNumber = segmentIndex + 1;
        const segmentLeft = segment.uiX;
        const segmentRight = segment.uiX + segment.width;

        // Full detail mode (captureAllSegmentsProducts style)
        if (detailLevel === 'full') {
            console.log("=".repeat(100));
            console.log(`📍 SEGMENT ${segmentNumber}: X=${segmentLeft.toFixed(3)}m to ${segmentRight.toFixed(3)}m (Width: ${segment.width.toFixed(3)}m)`);
            console.log("=".repeat(100));

            // Find all fixtures in this segment
            const segmentFixtures = allFixtures.filter(fixture => {
                const fixtureX = fixture.uiX;
                return fixtureX >= segmentLeft && fixtureX < segmentRight;
            }).sort((a, b) => a.uiX - b.uiX);

            console.log(`🏢 Fixtures in Segment ${segmentNumber}: ${segmentFixtures.length}\n`);

            const fixturesData = [];

            // Process each fixture in this segment
            segmentFixtures.forEach((fixture, fixtureIndex) => {
                const fixtureNumber = fixtureIndex + 1;

                console.log(`   ${"─".repeat(90)}`);
                console.log(`   🏗️  FIXTURE ${fixtureNumber} in Segment ${segmentNumber}`);
                console.log(`   ${"─".repeat(90)}`);
                console.log(`   📐 Fixture Boundaries: X=${fixture.uiX.toFixed(3)}m to ${(fixture.uiX + fixture.width).toFixed(3)}m`);
                console.log(`   📏 Fixture Width: ${fixture.width.toFixed(3)}m`);
                console.log(`   🔧 canCombine: ${fixture.canCombine}`);

                // Find all products on this fixture
                const fixtureProducts = allPositions.filter(pos => {
                    return pos.fixture && pos.fixture.uuid === fixture.uuid;
                }).sort((a, b) => {
                    // Sort by Y (top to bottom), then X (left to right)
                    const yDiff = b.transform.worldPos.y - a.transform.worldPos.y;
                    if (Math.abs(yDiff) > 0.01) return yDiff;
                    return a.uiX - b.uiX;
                });

                console.log(`   📦 Products on Fixture: ${fixtureProducts.length}\n`);

                if (fixtureProducts.length === 0) {
                    console.log(`   ℹ️  No products on this fixture\n`);
                } else {
                    // Group products by shelf (Y level)
                    const productsByShelf = {};
                    fixtureProducts.forEach(pos => {
                        const shelfY = Math.round(pos.transform.worldPos.y * 1000) / 1000;
                        if (!productsByShelf[shelfY]) {
                            productsByShelf[shelfY] = [];
                        }
                        productsByShelf[shelfY].push(pos);
                    });

                    const shelfLevels = Object.keys(productsByShelf).sort((a, b) => parseFloat(b) - parseFloat(a));

                    shelfLevels.forEach((shelfY, shelfIndex) => {
                        const shelfProducts = productsByShelf[shelfY];
                        console.log(`   Shelf ${shelfIndex + 1} (Y=${shelfY}m): ${shelfProducts.length} products`);
                    });

                    // Store fixture data
                    fixturesData.push({
                        fixtureNumber: fixtureNumber,
                        fixtureUuid: fixture.uuid,
                        boundaries: { left: fixtureLeft, right: fixtureRight },
                        canCombine: fixture.canCombine,
                        productsByShelf: productsByShelf,
                        totalProducts: fixtureProducts.length
                    });
                }
            });

            console.log("=".repeat(100) + "\n");

            // Store segment data
            segmentData.push({
                segmentNumber: segmentNumber,
                boundaries: { left: segmentLeft, right: segmentRight },
                width: segment.width,
                fixtures: fixturesData,
                totalFixtures: segmentFixtures.length
            });

        } else {

            console.log(`\nSegment ${segmentNumber}`);

            // Find all products where AT LEAST 80% of width is in THIS SEGMENT
            const segmentProducts = allPositions.filter(pos => {
                const productLeft = pos.uiX;
                const productWidth = pos.facings.x * pos.merchSize.x;
                const productRight = productLeft + productWidth;

                // Calculate how much of the product is within SEGMENT boundaries
                const overlapLeft = Math.max(productLeft, segmentLeft);
                const overlapRight = Math.min(productRight, segmentRight);
                const overlapWidth = Math.max(0, overlapRight - overlapLeft);

                // Calculate percentage of product width that's in this segment
                const percentageInSegment = (overlapWidth / productWidth) * 100;

                // At least 80% of product must be in this segment
                return percentageInSegment >= 80;
            });

            if (segmentProducts.length === 0) {
                console.log(`  No products in this segment`);
                return;
            }

            // Group products by Y level (shelf)
            const productsByShelf = {};
            segmentProducts.forEach(pos => {
                const shelfY = Math.round(pos.transform.worldPos.y * 1000) / 1000;
                if (!productsByShelf[shelfY]) {
                    productsByShelf[shelfY] = [];
                }
                productsByShelf[shelfY].push(pos);
            });

            // Sort shelves top to bottom
            const shelfLevels = Object.keys(productsByShelf).sort((a, b) => parseFloat(b) - parseFloat(a));

            // Log each shelf as a "fixture"
            shelfLevels.forEach((shelfY, fixtureIndex) => {
                const fixtureNumber = fixtureIndex + 1;
                const shelfProducts = productsByShelf[shelfY].sort((a, b) => a.uiX - b.uiX);
                const upcList = shelfProducts.map(pos => pos.product.upc.slice(-6)).join(', ');

                console.log(`  Fixture ${fixtureNumber}: ${upcList}`);

                // Capture data if requested or in 'two' mode
                if (captureData || mode === 'two') {
                    shelfProducts.forEach(pos => {
                        capturedData[pos.product.upc] = {
                            segment: segmentNumber,
                            fixture: fixtureNumber,
                            shelfY: shelfY
                        };
                    });
                }
            });
        }
    });

    // Return appropriate data structure based on mode
    if (detailLevel === 'full') {
        // Summary for 'all' mode
        console.log("\n" + "═".repeat(100));
        console.log("📋 COMPLETE INVENTORY SUMMARY");
        segmentData.forEach(seg => {
            const totalProducts = seg.fixtures.reduce((sum, fix) => sum + fix.totalProducts, 0);
            console.log(`Segment ${seg.segmentNumber}: ${seg.totalFixtures} fixtures, ${totalProducts} products`);
        });
        console.log("═".repeat(100));

        return {
            segments: segmentData,
            totalSegments: segments.length,
            captureTime: new Date().toISOString()
        };
    } else if (mode === 'two') {
        return capturedData;
    } else {
        return captureData ? capturedData : undefined;
    }
}

function captureLastSegmentProducts(targetDoc) {
    const pog = targetDoc.data.planogram;
    const segments = Array.from(pog.segments).sort((a, b) => a.uiX - b.uiX);

    if (segments.length === 0) {
        console.log("No segments found");
        return { products: {} };
    }

    const lastSegment = segments.reduce((rightmost, seg) => seg.uiX > rightmost.uiX ? seg : rightmost);
    const lastSegmentLeft = lastSegment.uiX;
    const lastSegmentRight = lastSegment.uiX + lastSegment.width;

    console.log(`🎯 Last segment (rightmost): X=${lastSegmentLeft.toFixed(3)}m to ${lastSegmentRight.toFixed(3)}m`);
    console.log(`   ℹ️  Using rightmost segment by position (handles reverse flow planograms)`);

    const allPositions = Array.from(pog.positions);
    const lastSegmentProducts = allPositions.filter(pos => pos.uiX >= lastSegmentLeft && pos.uiX < lastSegmentRight);

    const productsByShelf = {};
    lastSegmentProducts.forEach(pos => {
        const shelfY = Math.round(pos.transform.worldPos.y * 1000) / 1000;
        (productsByShelf[shelfY] = productsByShelf[shelfY] || []).push(pos.product.upc);
    });

    Object.keys(productsByShelf).sort((a, b) => parseFloat(b) - parseFloat(a))
        .forEach(shelfY => console.log(`Y=${shelfY}m: ${productsByShelf[shelfY].join(', ')}`));

    console.log(`Total: ${lastSegmentProducts.length} products in last segment`);

    return {
        segmentLeft: lastSegmentLeft,
        segmentRight: lastSegmentRight,
        products: productsByShelf,
        totalCount: lastSegmentProducts.length
    };
}

// Compares snapshots between 2 specific segments
function compareAgainstOriginalSnapshot(originalSnapshot, currentSnapshot, segment1Number, segment2Number) {
    const displacedProducts = [];

    // Only check products that were originally in these two segments
    for (const [upc, beforeLocation] of Object.entries(originalSnapshot)) {
        if (beforeLocation.segment !== segment1Number && beforeLocation.segment !== segment2Number) {
            continue; // Skip products not in these segments
        }

        const afterLocation = currentSnapshot[upc];

        if (!afterLocation) {
            console.log(`⚠️ Product ${upc.slice(-6)} was removed during processing`);
            continue;
        }

        // Check if segment changed
        if (beforeLocation.segment !== afterLocation.segment) {
            displacedProducts.push({
                upc: upc,
                beforeSegment: beforeLocation.segment,
                beforeFixture: beforeLocation.fixture,
                afterSegment: afterLocation.segment,
                afterFixture: afterLocation.fixture
            });
        }
    }

    return displacedProducts;
}

// Scans ENTIRE planogram for split UPC scenarios 
function detectAllSplitUPCsInPlanogram(targetDoc) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`🔍 SCANNING ENTIRE PLANOGRAM FOR SPLIT UPC SCENARIOS`);
    console.log(`${"=".repeat(80)}`);

    const pog = targetDoc.data.planogram;
    const allSegments = Array.from(pog.segments).sort((a, b) => a.uiX - b.uiX);
    const upcLocationMap = {};

    // Build UPC location map
    Array.from(pog.positions).forEach(pos => {
        const upc = pos.product.upc;
        const productLeft = pos.uiX;
        const productWidth = pos.facings.x * pos.merchSize.x;
        const productRight = productLeft + productWidth;

        // Find segment (80% overlap rule)
        let segmentNumber = null;
        for (let i = 0; i < allSegments.length; i++) {
            const seg = allSegments[i];
            const overlapLeft = Math.max(productLeft, seg.uiX);
            const overlapRight = Math.min(productRight, seg.uiX + seg.width);
            const overlapWidth = Math.max(0, overlapRight - overlapLeft);

            if ((overlapWidth / productWidth) * 100 >= 80) {
                segmentNumber = i + 1;
                break;
            }
        }

        if (!segmentNumber) return;

        if (!upcLocationMap[upc]) {
            upcLocationMap[upc] = { upc, segments: new Set(), positionsBySegment: {} };
        }

        upcLocationMap[upc].segments.add(segmentNumber);
        (upcLocationMap[upc].positionsBySegment[segmentNumber] =
            upcLocationMap[upc].positionsBySegment[segmentNumber] || []).push(pos);
    });

    // Find adjacent segment splits
    const allSplitUPCs = [];

    for (const [upc, data] of Object.entries(upcLocationMap)) {
        const segmentArray = Array.from(data.segments).sort((a, b) => a - b);

        if (segmentArray.length !== 2) {
            if (segmentArray.length > 2) {
                console.log(`   ⚠️ Skipping UPC ...${upc.slice(-6)}: appears in ${segmentArray.length} segments (only 2-segment splits supported)`);
            }
            continue;
        }

        const [seg1, seg2] = segmentArray;
        if (seg2 !== seg1 + 1) continue; // Must be adjacent

        const seg1Positions = data.positionsBySegment[seg1] || [];
        const seg2Positions = data.positionsBySegment[seg2] || [];

        allSplitUPCs.push({
            upc,
            segment1Number: seg1,
            segment2Number: seg2,
            segment1: allSegments[seg1 - 1],
            segment2: allSegments[seg2 - 1],
            segment1Positions: seg1Positions.map(pos => ({
                position: pos,
                segment: seg1,
                fixture: null,
                shelfY: Math.round(pos.transform.worldPos.y * 1000) / 1000
            })),
            segment2Positions: seg2Positions.map(pos => ({
                position: pos,
                segment: seg2,
                fixture: null,
                shelfY: Math.round(pos.transform.worldPos.y * 1000) / 1000
            })),
            totalFacingsSegment1: seg1Positions.reduce((sum, p) => sum + p.facings.x, 0),
            totalFacingsSegment2: seg2Positions.reduce((sum, p) => sum + p.facings.x, 0)
        });
    }

    // Filter for "fell back" splits (1 facing in either segment)
    const fellBackSplits = allSplitUPCs.filter(split =>
        split.totalFacingsSegment1 === 1 || split.totalFacingsSegment2 === 1
    );

    // Logging
    if (allSplitUPCs.length > fellBackSplits.length) {
        console.log(`   ℹ️  Found ${allSplitUPCs.length - fellBackSplits.length} intentional split(s) (balanced distribution) - ignoring`);
        allSplitUPCs.filter(split => !fellBackSplits.includes(split)).forEach(split => {
            console.log(`      • UPC ...${split.upc.slice(-6)}: ${split.totalFacingsSegment1} facings in Seg ${split.segment1Number}, ${split.totalFacingsSegment2} facings in Seg ${split.segment2Number} (INTENTIONAL - keeping)`);
        });
    }

    if (fellBackSplits.length === 0) {
        console.log(`✅ No "fell back" split scenarios detected (all splits are intentional)`);
    } else {
        console.log(`🚨 SPLIT UPC SCENARIOS DETECTED (fell back): ${fellBackSplits.length}\n`);
        fellBackSplits.forEach((split, index) => {
            console.log(`   ${index + 1}. UPC ...${split.upc.slice(-6)}:`);
            console.log(`      Segment ${split.segment1Number}: ${split.totalFacingsSegment1} facing(s)`);
            console.log(`      Segment ${split.segment2Number}: ${split.totalFacingsSegment2} facing(s)`);
        });
    }

    console.log(`${"=".repeat(80)}\n`);

    return fellBackSplits;
}
// Processes all split UPCs found in the planogram based on desc 13 configuration - FINAL step of the automation
async function processSplitUPCsBasedOnDesc13(targetDoc) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`🎯 DESC 13 SPLIT UPC PROCESSING - FINAL STEP`);
    console.log(`${"=".repeat(80)}`);

    // Detect all split UPCs in the planogram
    const allSplitUPCs = detectAllSplitUPCsInPlanogram(targetDoc);

    if (allSplitUPCs.length === 0) {
        console.log(`✅ No split UPCs to process - planogram is clean\n`);
        return;
    }

    // Get desc 13 configuration
    const allowSplitting = isUPCSplittingAllowed(targetDoc);

    console.log(`\n${"=".repeat(80)}`);
    console.log(`⚙️ DESC 13 CONFIGURATION: ${allowSplitting ? 'YES (ALLOW SPLITTING)' : 'NO (PREVENT SPLITTING)'}`);
    console.log(`${"=".repeat(80)}\n`);

    // Process each split UPC
for (const splitUPC of allSplitUPCs) {
    await handleSplitUPC(targetDoc, splitUPC, allowSplitting);
}

    console.log(`\n${"=".repeat(80)}`);
    console.log(`✅ DESC 13 SPLIT UPC PROCESSING COMPLETE`);
    console.log(`${"=".repeat(80)}\n`);
}


// Handles split UPC scenarios based on DESC 13 setting (YES = allow, NO = prevent)
async function handleSplitUPC(targetDoc, splitUPC, allowMode) {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`${allowMode ? '✅' : '🚫'} HANDLING SPLIT UPC (${allowMode ? 'ALLOW' : 'PREVENT'} MODE): ...${splitUPC.upc.slice(-6)}`);
    
    if (allowMode) {
        console.log(`   Keeping split: ${splitUPC.totalFacingsSegment1} in Seg ${splitUPC.segment1Number}, ${splitUPC.totalFacingsSegment2} in Seg ${splitUPC.segment2Number}`);
    } else {
        console.log(`   Removing split: Deleting from Seg ${splitUPC.segment1Number}, inflating in Seg ${splitUPC.segment2Number}`);
    }
    console.log(`${"=".repeat(70)}`);

    const pog = targetDoc.data.planogram;

    // PREVENT MODE: Delete facings from segment 1 first
    let deletedCount = 0;
    if (!allowMode) {
        const fallenBackPositions = splitUPC.segment1Positions;
        console.log(`   🗑️ Deleting facing(s) from Segment ${splitUPC.segment1Number}...`);

        for (const posData of fallenBackPositions) {
            const pos = posData.position;
            console.log(`      Deleting ...${pos.product.upc.slice(-6)} with ${pos.facings.x} facing(s)`);
            pos.parent = null;
            deletedCount += pos.facings.x;
        }

        console.log(`   ✅ Deleted ${deletedCount} facing(s) from Segment ${splitUPC.segment1Number}`);
    }

    // SHARED LOGIC: Find target segment and inflate
    let targetSegmentNumber, targetSegmentPositions;
    
    if (allowMode) {
        // ALLOW: Find gap segment (segment with fewer facings)
        targetSegmentNumber = splitUPC.totalFacingsSegment1 < splitUPC.totalFacingsSegment2
            ? splitUPC.segment1Number
            : splitUPC.segment2Number;
        targetSegmentPositions = targetSegmentNumber === splitUPC.segment1Number
            ? splitUPC.segment1Positions
            : splitUPC.segment2Positions;
        
        const gapFacings = Math.min(splitUPC.totalFacingsSegment1, splitUPC.totalFacingsSegment2);
        console.log(`   🎯 Gap detected in: Segment ${targetSegmentNumber} (${gapFacings} facings)`);
        console.log(`   🔍 Inflating a product in Segment ${targetSegmentNumber} to fill the gap...`);
    } else {
        // PREVENT: Inflate in segment 2 (where original product is)
        targetSegmentNumber = splitUPC.segment2Number;
        targetSegmentPositions = splitUPC.segment2Positions;
        
        if (targetSegmentPositions.length === 0) {
            console.log(`   ❌ ERROR: No positions found in original segment to inflate`);
            return false;
        }

        // For PREVENT mode, directly inflate the split UPC itself
        const positionToInflate = targetSegmentPositions[0].position;
        console.log(`   ➕ Inflating ...${positionToInflate.product.upc.slice(-6)} in Segment ${targetSegmentNumber}...`);
        console.log(`      Current facings: ${positionToInflate.facings.x}`);
        console.log(`      Adding back: ${deletedCount} facing(s)`);

        const oldFacings = positionToInflate.facings.x;
        positionToInflate.facings.x = oldFacings + deletedCount;

        console.log(`   ➕ Inflating: ${oldFacings} → ${oldFacings + deletedCount} facings`);
        console.log(`   Reason: PREVENT MODE - returning ${deletedCount} facing(s)`);

        // Layout fixtures
        if (positionToInflate.fixture) {
            positionToInflate.fixture.layoutByRank();
            await sleep(100);
        }

        if (splitUPC.segment1Positions.length > 0 && splitUPC.segment1Positions[0].position.fixture) {
            const deletedFixture = splitUPC.segment1Positions[0].position.fixture;
            if (deletedFixture.uuid !== positionToInflate.fixture.uuid) {
                deletedFixture.layoutByRank();
                await sleep(100);
            }
        }

        pog.updateNodes();
        await sleep(150);

        console.log(`   ✅ Split UPC handled successfully (PREVENT mode)`);
        console.log(`   🎯 All facings now unified in Segment ${targetSegmentNumber}`);
        console.log(`${"=".repeat(70)}\n`);
        return true;
    }

    // ALLOW MODE ONLY: Find another product to inflate
    if (targetSegmentPositions.length === 0) {
        console.log(`   ❌ No positions found in gap segment`);
        return false;
    }

    const targetShelfY = targetSegmentPositions[0].shelfY;
    const targetFixture = targetSegmentPositions[0].position.fixture;

    const shelfPositions = Array.from(pog.positions).filter(pos =>
        pos.fixture?.uuid === targetFixture.uuid &&
        Math.abs(pos.transform.worldPos.y - targetShelfY) < 0.01 &&
        pos.parent !== null
    );

    if (shelfPositions.length === 0) {
        console.log(`   ❌ No products found on target shelf for inflation`);
        return false;
    }

    const availableSpace = calculateFixtureAvailableSpace(targetFixture, targetShelfY);
    console.log(`   📊 Available space on fixture: ${(availableSpace * 1000).toFixed(1)}mm`);

    if (availableSpace < 0.03) {
        console.log(`   ⚠️ Insufficient space for inflation (< 30mm)`);
        return false;
    }

   // Find best product to inflate
    const candidates = buildInflationCandidates(shelfPositions);

    console.log(`\n   📋 Evaluating ${candidates.length} inflation candidates`);

    const selection = selectProductForInflation(candidates, availableSpace);
    
    if (!selection) {
        console.log(`\n   ❌ No suitable product found for inflation`);
        return false;
    }
    
    const selectedProduct = selection.product;
    console.log(`\n   ✅ Selected: ...${selectedProduct.pos.product.upc.slice(-6)} - ${selection.reason}`);

    const oldFacings = selectedProduct.pos.facings.x;
    await inflateSplitUPCProduct(selectedProduct.pos, oldFacings, oldFacings + 1, selection.reason);
    console.log(`   ✅ Split UPC handled successfully (ALLOW mode)`);
    console.log(`${"=".repeat(70)}\n`);

    return true;
}

async function inflateSplitUPCProduct(pos, oldFacings, newFacings, reason) {
    console.log(`   ➕ Inflating: ${oldFacings} → ${newFacings} facings`);
    console.log(`   Reason: ${reason}`);

    pos.facings.x = newFacings;

    if (pos.fixture) {
        pos.fixture.layoutByRank();
        await sleep(100);
    }

    const pog = pos.planogram || pos.fixture?.planogram;
    if (pog) {
        pog.updateNodes();
        await sleep(150);
    }
}

async function rescueDisplacedProducts(targetDoc, displacedProducts, currentSegment, nextSegment, segmentBreakNumber) {
    console.log(`\n🚑 INITIATING RESCUE FOR ${displacedProducts.length} DISPLACED PRODUCT(S)...`);

    const pog = targetDoc.data.planogram;
    const allPositions = Array.from(pog.positions);
    const allSegments = Array.from(pog.segments).sort((a, b) => a.uiX - b.uiX);
    const isLastSegmentBreak = nextSegment === allSegments[allSegments.length - 1];

    for (const displacedInfo of displacedProducts) {
        const displacedUPC = displacedInfo.upc;

        console.log(`\n${"=".repeat(70)}`);
        console.log(`🔧 RESCUING: ${displacedUPC.slice(-6)}`);
        console.log(`   Original location: Segment ${displacedInfo.beforeSegment} Fixture ${displacedInfo.beforeFixture}`);
        console.log(`   Current location: Segment ${displacedInfo.afterSegment} Fixture ${displacedInfo.afterFixture}`);
        console.log(`   Segment break type: ${isLastSegmentBreak ? '⚠️ LAST SEGMENT BREAK' : 'Standard segment break'}`);
        console.log(`${"=".repeat(70)}`);

        const displacedPos = allPositions.find(pos => pos.product.upc === displacedUPC);

        if (!displacedPos) {
            console.log(`   ❌ ERROR: Could not locate displaced product in planogram`);
            continue;
        }

        const currentX = displacedPos.uiX;
        const currentY = Math.round(displacedPos.transform.worldPos.y * 1000) / 1000;
        const currentFixture = displacedPos.fixture;

        console.log(`   Current position: X=${currentX.toFixed(3)}m, Y=${currentY.toFixed(3)}m`);
        console.log(`\n   ${isLastSegmentBreak ? '⚡ Using LAST SEGMENT BREAK rescue logic (advanced)' : '📋 Using STANDARD rescue logic (non-last segment break)'}`);

        if (isLastSegmentBreak) {
            console.log(`   📍 Current segment: ${currentSegment.uiX.toFixed(3)}m to ${(currentSegment.uiX + currentSegment.width).toFixed(3)}m`);
            console.log(`   📍 Last segment: ${nextSegment.uiX.toFixed(3)}m to ${(nextSegment.uiX + nextSegment.width).toFixed(3)}m`);
        }

        const segmentBreakPoint = currentSegment.uiX + currentSegment.width;

        // Get products to left of displaced product
        const productsToLeft = allPositions.filter(pos =>
            pos.fixture?.uuid === currentFixture.uuid &&
            Math.abs(pos.transform.worldPos.y - currentY) < 0.01 &&
            pos.uiX < currentX
        ).sort((a, b) => a.uiX - b.uiX);

        console.log(`   PRODUCTS TO LEFT: Found ${productsToLeft.length} products`);

        if (productsToLeft.length === 0) {
            console.log(`   ⚠️ RESCUE NOT POSSIBLE: No products to the left (displaced product is leftmost)`);
            continue;
        }

        // Display products (only for standard mode)
        if (!isLastSegmentBreak) {
            console.log(`\n   UPC             | Facings | Width(mm) | Position`);
            console.log(`   ${"-".repeat(60)}`);
            productsToLeft.forEach(pos => {
                console.log(`   ...${pos.product.upc.slice(-6)} | ${pos.facings.x}       | ${(pos.product.width * 1000).toFixed(1).padEnd(9)} | ${pos.uiX.toFixed(3)}m`);
            });
        }

        // ATTEMPT INFLATION (different selection logic per mode)
        let selectedProduct = null;
        let reason = '';
        let inflationAttempted = false;

        if (isLastSegmentBreak) {
            // LAST SEGMENT: Try advanced strategies
            console.log(`\n   🎯 PHASE 1: Attempting inflation in CURRENT segment`);
            const availableSpace = calculateFixtureAvailableSpace(currentFixture, currentY);
            console.log(`   📏 Available space on current fixture: ${(availableSpace * 1000).toFixed(1)}mm`);
            console.log(`\n   Evaluating ${productsToLeft.length} Phase 1 candidates`);

            const candidates = buildInflationCandidates(productsToLeft);
            const result = await tryInflationStrategies(candidates, currentFixture, currentY, segmentBreakPoint, availableSpace, "PHASE 1");

            if (result) {
                selectedProduct = result.pos;
                reason = result.reason;
                inflationAttempted = true;
            } else {
                console.log(`\n   ❌ PHASE 1 FAILED: No suitable product found in current segment`);
            }
        } else {
            // STANDARD: Use smallest width
            console.log(`\n   🎯 Selecting product with smallest width...`);
            const smallestWidthProduct = productsToLeft.reduce((smallest, pos) =>
                pos.product.width < smallest.product.width ? pos : smallest
            );
            selectedProduct = smallestWidthProduct;
            reason = `SMALLEST_WIDTH (${(selectedProduct.product.width * 1000).toFixed(1)}mm)`;
            inflationAttempted = true;
            console.log(`   ✅ Selected: ...${selectedProduct.product.upc.slice(-6)} - ${reason}`);
        }

        // EXECUTE INFLATION (if product selected)
        let inflationSucceeded = false;

        if (inflationAttempted && selectedProduct) {
            const originalFacings = selectedProduct.facings.x;

            if (isLastSegmentBreak) {
                console.log(`\n   ✅ PHASE 1 SUCCESS: Inflating product in current segment`);
            }

            const rescuedUPC = await attemptRescueByInflation(selectedProduct, displacedUPC, reason);

            if (rescuedUPC) {
                // POST-INFLATION VERIFICATION (different per mode)
                if (isLastSegmentBreak) {
                    // Last segment: Just check for overlaps
                    console.log(`   🔍 Checking for overlaps created by inflation...`);
                    await checkAndResolvePostRescueOverlaps(targetDoc, rescuedUPC, currentSegment, nextSegment, segmentBreakNumber);
                    inflationSucceeded = true;
                } else {
                    // Standard: Post-flight check, revert if needed
                    console.log(`\n   🔍 POST-FLIGHT CHECK: Verifying no overlaps created...`);

                    const bufferZone = 0.005;
                    const freshPositions = Array.from(pog.positions);
                    const currentSegmentOverlaps = freshPositions.filter(pos => {
                        const productRight = pos.uiX + (pos.facings.x * pos.merchSize.x);
                        return pos.uiX < (segmentBreakPoint - bufferZone) &&
                            productRight > (segmentBreakPoint + bufferZone);
                    });

                    if (currentSegmentOverlaps.length > 0) {
                        console.log(`   🚨 POST-FLIGHT FAILED: Inflation created ${currentSegmentOverlaps.length} overlap(s)`);
                        currentSegmentOverlaps.forEach(pos => {
                            console.log(`      • Product ...${pos.product.upc.slice(-6)} now overlapping segment break`);
                        });

                        console.log(`\n   ⏪ REVERTING INFLATION...`);
                        console.log(`      • Product: ...${selectedProduct.product.upc.slice(-6)}`);
                        console.log(`      • Reverting: ${selectedProduct.facings.x} → ${originalFacings} facings`);

                        selectedProduct.facings.x = originalFacings;

                        if (selectedProduct.fixture) {
                            selectedProduct.fixture.layoutByRank();
                            await sleep(100);
                        }

                        pog.updateNodes();
                        await sleep(150);

                        console.log(`      ✅ Inflation reverted successfully`);
                        inflationSucceeded = false;
                    } else {
                        console.log(`   ✅ POST-FLIGHT PASSED: No overlaps created by inflation`);
                        console.log(`   🎉 Inflation rescue successful`);
                        await checkAndResolvePostRescueOverlaps(targetDoc, rescuedUPC, currentSegment, nextSegment, segmentBreakNumber);
                        inflationSucceeded = true;
                    }
                }
            }
        }

        // FALLBACK: DIRECT MOVE (if inflation didn't work)
        if (!inflationSucceeded) {
            console.log(`\n   ${isLastSegmentBreak ? '🆘 PHASE 2: LAST RESORT - Direct product relocation' : '🔄 SWITCHING TO DIRECT MOVE APPROACH (duplicate + delete)'}`);
            
            if (isLastSegmentBreak) {
                console.log(`   ⚠️ Phase 1 inflation failed - using direct move approach`);
            }

            const currentDisplacedPos = Array.from(pog.positions).find(pos => pos.product.upc === displacedUPC);

            if (!currentDisplacedPos) {
                console.log(`   ❌ RESCUE FAILED: Cannot find displaced product ${displacedUPC.slice(-6)}`);
                continue;
            }

            console.log(`   📦 Displaced product found: ${displacedUPC.slice(-6)}`);
            console.log(`   📍 Current location: X=${currentDisplacedPos.uiX.toFixed(3)}m, Y=${currentDisplacedPos.transform.worldPos.y.toFixed(3)}m`);

            // Determine target segment
            const targetSegmentNumber = isLastSegmentBreak ? 
                (allSegments.length) : // Last segment (by number)
                displacedInfo.beforeSegment; // Original segment

            const targetSegmentIndex = targetSegmentNumber - 1;
            const targetSegment = allSegments[targetSegmentIndex];

            if (!targetSegment) {
                console.log(`   ❌ RESCUE FAILED: Cannot find target segment ${targetSegmentNumber}`);
                continue;
            }

            console.log(`   🎯 Target: ${isLastSegmentBreak ? 'Last segment' : `Segment ${displacedInfo.beforeSegment} (where it should be)`} (X=${targetSegment.uiX.toFixed(3)}m to ${(targetSegment.uiX + targetSegment.width).toFixed(3)}m)`);

            const targetFixture = findTargetFixtureInSegment(targetDoc, targetSegment, currentDisplacedPos.fixture.position.y);

            if (!targetFixture) {
                console.log(`   ❌ RESCUE FAILED: No fixture found in segment ${targetSegmentNumber} at Y=${currentDisplacedPos.fixture.position.y.toFixed(3)}m`);
                continue;
            }

            console.log(`   🏢 Target fixture found at Y=${targetFixture.position.y.toFixed(3)}m`);
            console.log(`   📍 Target fixture boundaries: X=${targetFixture.uiX.toFixed(3)}m to ${(targetFixture.uiX + targetFixture.width).toFixed(3)}m`);

            const leftmostAvailableX = findLeftmostAvailablePosition(targetFixture);
            console.log(`   🎯 LEFTMOST AVAILABLE position: ${(targetFixture.uiX + leftmostAvailableX).toFixed(3)}m (relative X=${leftmostAvailableX.toFixed(3)}m)`);

            console.log(`\n   🔧 EXECUTING DIRECT MOVE:`);
            console.log(`      1. Duplicating product in ${isLastSegmentBreak ? 'last' : ''} segment ${targetSegmentNumber}`);

            const duplicatePos = await createDuplicatePosition(targetDoc, currentDisplacedPos, targetFixture);

            if (!duplicatePos) {
                console.log(`   ❌ RESCUE FAILED: Could not create duplicate in segment ${targetSegmentNumber}`);
                continue;
            }

            duplicatePos.position.x = leftmostAvailableX;
            duplicatePos.position.y = 0;
            duplicatePos.position.z = 0;
            duplicatePos.rank.x = 0.5;

            console.log(`      ✅ Duplicate created at leftmost position`);
            console.log(`      2. Deleting original from ${isLastSegmentBreak ? 'current' : ''} segment ${displacedInfo.afterSegment}`);

            currentDisplacedPos.parent = null;

            console.log(`      ✅ Original deleted`);
            console.log(`      3. Applying layout changes`);

            targetFixture.layoutByRank();
            await sleep(100);

            if (currentDisplacedPos.fixture) {
                currentDisplacedPos.fixture.layoutByRank();
                await sleep(100);
            }

            pog.updateNodes();
            await sleep(150);

            console.log(`\n   ✅ ${isLastSegmentBreak ? 'PHASE 2' : 'DIRECT MOVE'} SUCCESS: Product ${isLastSegmentBreak ? 'directly relocated to last segment' : `relocated to segment ${displacedInfo.beforeSegment}`}`);
            console.log(`   🎯 Product ${displacedUPC.slice(-6)} now in correct segment via direct move`);
        }
    }

    console.log(`\n✅ RESCUE OPERATIONS COMPLETE\n`);
}



function calculateFixtureAvailableSpace(fixture, yLevel, skipLog = false) {
    const pog = fixture.planogram;
    const productsOnFixture = Array.from(pog.positions).filter(pos =>
        pos.fixture?.uuid === fixture.uuid &&
        Math.abs(pos.transform.worldPos.y - yLevel) < 0.01
    );

    const totalProductWidth = productsOnFixture.reduce((sum, pos) =>
        sum + (pos.facings.x * pos.merchSize.x), 0
    );

    const availableSpace = fixture.width - totalProductWidth;

    if (!skipLog) {
        console.log(`      Available space: ${(availableSpace * 1000).toFixed(1)}mm`);
    }

    return availableSpace;
}

function buildInflationCandidates(positions, includeExtras = false) {
    return positions.map(pos => {
        const movement = pos.product.data.performanceValue?.get(1) || 0;
        const capacity = pos.planogramProduct?.calculatedFields?.capacity ||
            pos.capacity || pos.product?.capacity || 0;
        const dos = (movement > 0 && capacity > 0) ? (capacity / movement) * 7 : 999;

        const candidate = {
            pos,
            dos,
            width: pos.product.width,
            singleFacingWidth: pos.merchSize.x / pos.facings.x
        };

        if (includeExtras) {
            candidate.currentFacings = pos.facings.x;
            candidate.upc = pos.product.upc;
        }

        return candidate;
    });
}

function selectProductForInflation(candidates, availableSpace) {
    const validDOSProducts = candidates.filter(c => c.dos < 999).sort((a, b) => a.dos - b.dos);
    const allDOSareNA = validDOSProducts.length === 0;
    
    if (allDOSareNA) {
        // All DOS are N/A - use smallest width strategy
        const smallest = candidates.reduce((s, c) => c.width < s.width ? c : s);
        
        if (smallest.singleFacingWidth <= availableSpace) {
            return {
                product: smallest,
                reason: `SMALLEST_WIDTH (${(smallest.width * 1000).toFixed(1)}mm)`
            };
        }
        return null; // Nothing fits
    }
    
    // Try lowest DOS first
    const lowestDOS = validDOSProducts[0];
    
    if (lowestDOS.singleFacingWidth <= availableSpace) {
        return {
            product: lowestDOS,
            reason: `LOWEST_DOS (${lowestDOS.dos.toFixed(2)})`
        };
    }
    
    // Fallback to smallest width
    const smallest = candidates.reduce((s, c) => c.width < s.width ? c : s);
    
    if (smallest.singleFacingWidth <= availableSpace) {
        return {
            product: smallest,
            reason: `SMALLEST_WIDTH (${(smallest.width * 1000).toFixed(1)}mm)`
        };
    }
    
    return null; // Nothing fits
}

async function tryInflationStrategies(candidates, fixture, yLevel, segmentBreakPoint, availableSpace, phaseName) {
    console.log(`\n   🎯 ${phaseName}: Trying inflation strategies...`);

    // Sort candidates by DOS (valid DOS first, then by value)
    const sortedByDOS = candidates
        .filter(c => c.dos < 999)
        .sort((a, b) => a.dos - b.dos);

    // STRATEGY 1: Lowest DOS product
    if (sortedByDOS.length > 0) {
        const lowestDOS = sortedByDOS[0];
        const singleFacingWidth = lowestDOS.pos.merchSize.x / lowestDOS.pos.facings.x;

        if (singleFacingWidth <= availableSpace) {
            // Check for overlap (only if segment break exists)
            if (segmentBreakPoint) {
                const wouldOverlap = await checkIfInflationCausesOverlap(
                    lowestDOS.pos,
                    singleFacingWidth,
                    segmentBreakPoint
                );

                if (!wouldOverlap) {
                    console.log(`      ✅ Strategy 1: Lowest DOS (${lowestDOS.dos.toFixed(2)})`);
                    return {
                        pos: lowestDOS.pos,
                        reason: `LOWEST_DOS (${lowestDOS.dos.toFixed(2)})`
                    };
                }
            } else {
                // No segment break to check (Phase 2)
                console.log(`      ✅ Strategy 1: Lowest DOS (${lowestDOS.dos.toFixed(2)})`);
                return {
                    pos: lowestDOS.pos,
                    reason: `LOWEST_DOS (${lowestDOS.dos.toFixed(2)})`
                };
            }
        }
    }

    // STRATEGY 2: Second lowest DOS product
    if (sortedByDOS.length > 1) {
        const secondLowestDOS = sortedByDOS[1];
        const singleFacingWidth = secondLowestDOS.pos.merchSize.x / secondLowestDOS.pos.facings.x;

        if (singleFacingWidth <= availableSpace) {
            // Check for overlap (only if segment break exists)
            if (segmentBreakPoint) {
                const wouldOverlap = await checkIfInflationCausesOverlap(
                    secondLowestDOS.pos,
                    singleFacingWidth,
                    segmentBreakPoint
                );

                if (!wouldOverlap) {
                    console.log(`      ✅ Strategy 2: Second lowest DOS (${secondLowestDOS.dos.toFixed(2)})`);
                    return {
                        pos: secondLowestDOS.pos,
                        reason: `SECOND_LOWEST_DOS (${secondLowestDOS.dos.toFixed(2)})`
                    };
                }
            } else {
                // No segment break to check (Phase 2)
                console.log(`      ✅ Strategy 2: Second lowest DOS (${secondLowestDOS.dos.toFixed(2)})`);
                return {
                    pos: secondLowestDOS.pos,
                    reason: `SECOND_LOWEST_DOS (${secondLowestDOS.dos.toFixed(2)})`
                };
            }
        } else {
            console.log(`      ❌ STRATEGY 2 REJECTED: Not enough space (needs ${(singleFacingWidth * 1000).toFixed(1)}mm, have ${(availableSpace * 1000).toFixed(1)}mm)`);
        }
    }

    // STRATEGY 3: Lowest width product (fallback)
    console.log(`\n   📋 STRATEGY 3: Trying lowest width product`);
    const lowestWidth = candidates.reduce((smallest, c) => {
        return c.width < smallest.width ? c : smallest;
    });

    const singleFacingWidth = lowestWidth.pos.merchSize.x / lowestWidth.pos.facings.x;

    console.log(`      Product: ...${lowestWidth.pos.product.upc.slice(-6)}`);
    console.log(`      Width: ${(lowestWidth.width * 1000).toFixed(1)}mm`);
    console.log(`      Single facing width: ${(singleFacingWidth * 1000).toFixed(1)}mm`);

    if (singleFacingWidth <= availableSpace) {
        // Check for overlap (only if segment break exists)
        if (segmentBreakPoint) {
            const wouldOverlap = await checkIfInflationCausesOverlap(
                lowestWidth.pos,
                singleFacingWidth,
                segmentBreakPoint
            );

            if (wouldOverlap) {
                console.log(`      ❌ STRATEGY 3 REJECTED: Would cause segment overlap`);
                return null;
            } else {
                console.log(`      ✅ STRATEGY 3 ACCEPTED: Fits without overlap`);
                return {
                    pos: lowestWidth.pos,
                    reason: `LOWEST_WIDTH (${(lowestWidth.width * 1000).toFixed(1)}mm)`
                };
            }
        } else {
            // No segment break to check (Phase 2)
            console.log(`      ✅ STRATEGY 3 ACCEPTED: Fits in available space`);
            return {
                pos: lowestWidth.pos,
                reason: `LOWEST_WIDTH (${(lowestWidth.width * 1000).toFixed(1)}mm)`
            };
        }
    } else {
        console.log(`      ❌ STRATEGY 3 REJECTED: Not enough space (needs ${(singleFacingWidth * 1000).toFixed(1)}mm, have ${(availableSpace * 1000).toFixed(1)}mm)`);
        return null;
    }
}

async function checkIfInflationCausesOverlap(position, singleFacingWidth, segmentBreakPoint) {

    const pog = position.planogram || position.fixture?.planogram;
    if (!pog) {
        console.log(`         ⚠️ Cannot access planogram - skipping cascade check`);
        return false;
    }

    const allPositions = Array.from(pog.positions);
    const currentY = Math.round(position.transform.worldPos.y * 1000) / 1000;

    // Get all products on same fixture/shelf as the product being inflated
    const productsOnSameShelf = allPositions.filter(pos => {
        const sameFixture = pos.fixture && position.fixture &&
            pos.fixture.uuid === position.fixture.uuid;
        const sameShelf = Math.abs(pos.transform.worldPos.y - currentY) < 0.01;
        return sameFixture && sameShelf;
    }).sort((a, b) => a.uiX - b.uiX);

    // Calculate the width increase from inflation
    const widthIncrease = singleFacingWidth;

    // Find the rightmost product on this shelf
    if (productsOnSameShelf.length === 0) {
        console.log(`         ⚠️ No products found on shelf - cannot check cascade`);
        return false;
    }

    const rightmostProduct = productsOnSameShelf[productsOnSameShelf.length - 1];
    const rightmostCurrentRight = rightmostProduct.uiX + (rightmostProduct.facings.x * rightmostProduct.merchSize.x);

    // Cascade effect 
    const productBeingInflatedIsLeftOfRightmost = position.uiX < rightmostProduct.uiX;

    if (productBeingInflatedIsLeftOfRightmost) {
        // The rightmost product will be pushed right by the inflation width
        const afterInflationRightmostEdge = rightmostCurrentRight + widthIncrease;
        console.log(`         After inflation rightmost edge: ${afterInflationRightmostEdge.toFixed(3)}m`);
        console.log(`         Segment break point: ${segmentBreakPoint.toFixed(3)}m`);

        const bufferZone = 0.005; // 5mm tolerance
        const wouldOverlap = afterInflationRightmostEdge > (segmentBreakPoint + bufferZone);

        if (wouldOverlap) {
            const overhang = afterInflationRightmostEdge - segmentBreakPoint;
            console.log(`         🚨 CASCADE OVERFLOW: Rightmost product would be pushed ${(overhang * 1000).toFixed(1)}mm past segment break`);
        } else {
            console.log(`         ✅ CASCADE SAFE: Rightmost product stays within segment boundaries`);
        }

        return wouldOverlap;
    } else {
        // The product being inflated IS the rightmost product
        const currentRight = position.uiX + (position.facings.x * position.merchSize.x);
        const afterInflationRight = position.uiX + ((position.facings.x + 1) * singleFacingWidth);

        console.log(`         Product being inflated IS rightmost`);
        console.log(`         Current right edge: ${currentRight.toFixed(3)}m`);
        console.log(`         After inflation right edge: ${afterInflationRight.toFixed(3)}m`);
        console.log(`         Segment break point: ${segmentBreakPoint.toFixed(3)}m`);

        const bufferZone = 0.005; // 5mm tolerance
        const wouldOverlap = afterInflationRight > (segmentBreakPoint + bufferZone);

        if (wouldOverlap) {
            const overhang = afterInflationRight - segmentBreakPoint;
            console.log(`         ⚠️ OVERLAP DETECTED: Product would extend ${(overhang * 1000).toFixed(1)}mm past segment break`);
        } else {
            console.log(`         ✅ NO OVERLAP: Product stays within segment boundaries`);
        }

        return wouldOverlap;
    }
}

async function verifyLastSegmentProducts(targetDoc, snapshot) {
    const pog = targetDoc.data.planogram;
    const allPositions = Array.from(pog.positions);

    // Get current last segment products
    const currentLastSegmentProducts = allPositions.filter(pos => {
        const posX = pos.uiX;
        return posX >= snapshot.segmentLeft && posX < snapshot.segmentRight;
    });

    // Group current products by shelf
    const currentProductsByShelf = {};
    currentLastSegmentProducts.forEach(pos => {
        const shelfY = Math.round(pos.transform.worldPos.y * 1000) / 1000;
        if (!currentProductsByShelf[shelfY]) {
            currentProductsByShelf[shelfY] = [];
        }
        currentProductsByShelf[shelfY].push(pos.product.upc);
    });

    // Log current state
    const currentShelfLevels = Object.keys(currentProductsByShelf).sort((a, b) => parseFloat(b) - parseFloat(a));
    currentShelfLevels.forEach(shelfY => {
        console.log(`Y=${shelfY}m: ${currentProductsByShelf[shelfY].join(', ')}`);
    });

    console.log(`Total: ${currentLastSegmentProducts.length} products in last segment`);

    // Find missing products 
    const missingProducts = [];
    Object.entries(snapshot.products).forEach(([shelfY, upcs]) => {
        const currentUpcsOnShelf = new Set(currentProductsByShelf[shelfY] || []);
        upcs.forEach(upc => {
            if (!currentUpcsOnShelf.has(upc)) {
                missingProducts.push({ upc, shelfY });
            }
        });
    });

    // Report discrepancies
    if (missingProducts.length > 0) {
        console.log("\n" + "!".repeat(80));
        console.log(`WARNING: ${missingProducts.length} PRODUCTS DISPLACED FROM LAST SEGMENT`);
        console.log("!".repeat(80));

        missingProducts.forEach(item => {
            console.log(`  UPC ${item.upc} (originally on Y=${item.shelfY}m) is NO LONGER in last segment`);
        });

        console.log("\n  Note: Displacement should have been handled during segment break processing");
        console.log("!".repeat(80));
    } else {
        console.log("\nSUCCESS: All original last segment products are still in last segment");
    }
}

async function attemptRescueByInflation(productToInflate, displacedUPC, reason) {
    console.log(`\n  ${"=".repeat(60)}`);
    console.log(`  RESCUE ATTEMPT: Inflating product to push ${displacedUPC.slice(-6)} right`);
    console.log(`  Reason: ${reason}`);
    console.log(`  ${"=".repeat(60)}`);

    const oldFacings = productToInflate.facings.x;
    const newFacings = oldFacings + 1;

    console.log(`  Inflating ...${productToInflate.product.upc.slice(-6)}: ${oldFacings} → ${newFacings} facings`);

    try {
        productToInflate.facings.x = newFacings;

        if (productToInflate.fixture) {
            productToInflate.fixture.layoutByRank();
            await new Promise(resolve => setTimeout(resolve, 150));
        }

        // Update planogram
        const pog = productToInflate.planogram || productToInflate.fixture?.planogram;
        if (pog) {
            pog.updateNodes();
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        console.log(`  Inflation applied successfully`);
        console.log(`  Products on fixture should now shift right, pushing displaced product into last segment`);

        // Return the displaced product's UPC so we can verify it moved correctly
        return displacedUPC;

    } catch (error) {
        console.log(`  ERROR during inflation: ${error.message}`);
        return null;
    }
}

async function checkAndResolvePostRescueOverlaps(targetDoc, rescuedUPC, currentSegment, nextSegment, segmentBreakNumber) {
    console.log(`\n   ${"=".repeat(60)}`);
    console.log(`   POST-RESCUE OVERLAP CHECK for ${rescuedUPC.slice(-6)}`);
    console.log(`   ${"=".repeat(60)}`);

    const pog = targetDoc.data.planogram;
    const allPositions = Array.from(pog.positions);

    const segmentBreakPoint = currentSegment.uiX + currentSegment.width;

    // Find the rescued product
    const rescuedProduct = allPositions.find(pos => pos.product.upc === rescuedUPC);

    if (!rescuedProduct) {
        console.log(`   Could not find rescued product ${rescuedUPC.slice(-6)}`);
        return;
    }

    // Check if it's overlapping the segment boundary
    const bufferZone = 0.005;
    const productLeft = rescuedProduct.uiX;
    const productRight = rescuedProduct.uiX + (rescuedProduct.facings.x * rescuedProduct.merchSize.x);

    const startsInCurrent = productLeft < (segmentBreakPoint - bufferZone);
    const endsInNext = productRight > (segmentBreakPoint + bufferZone);

    if (startsInCurrent && endsInNext) {
        console.log(`   OVERLAP DETECTED: Product ${rescuedUPC.slice(-6)} is spanning segment boundary`);
        console.log(`     Product position: ${productLeft.toFixed(3)}m to ${productRight.toFixed(3)}m`);
        console.log(`     Segment break: ${segmentBreakPoint.toFixed(3)}m`);
        console.log(`     Overhang: ${((productRight - segmentBreakPoint) * 1000).toFixed(1)}mm`);

        console.log(`\n   Applying overlap resolution scenarios...`);

        // Run through the same scenario handling as segment break processing
        await handleOverlapScenariosSequential(
            targetDoc,
            [rescuedProduct],
            currentSegment,
            nextSegment,
            segmentBreakNumber
        );

        // Verify it's resolved
        const verifyPositions = Array.from(pog.positions);
        const verifyProduct = verifyPositions.find(pos => pos.product.upc === rescuedUPC);

        if (verifyProduct) {
            const verifyRight = verifyProduct.uiX + (verifyProduct.facings.x * verifyProduct.merchSize.x);
            const stillOverlapping = verifyProduct.uiX < segmentBreakPoint && verifyRight > segmentBreakPoint;

            if (stillOverlapping) {
                console.log(`   WARNING: Overlap still exists after scenario handling`);
            } else {
                console.log(`   SUCCESS: Overlap resolved`);
            }
        }

    } else {
        console.log(`   No overlap detected - rescue successful`);
    }

    console.log(`   ${"=".repeat(60)}`);
}

// #endregion

// #region SEGMENT BREAK PROCESSING

function identifySegmentOverlaps(targetDoc) {
    console.log("🔍 Identifying products overlapping segment breaks...");

    const posits = targetDoc.data.planogram.positions;

    // Detect overlaps: product starts before fixture OR product ends after fixture
    const overlappingProducts = posits.filter(z =>
        z.fixture.uiX > z.uiX || (z.fixture.uiX + z.fixture.width) < (z.uiX + z.facings.x * z.merchSize.x)
    );

    console.log(`🚨 SEGMENT OVERLAP DETECTION RESULTS:`);
    console.log(`   📊 Total products overlapping segment breaks: ${overlappingProducts.length}`);

    if (overlappingProducts.length === 0) {
        console.log(`   ✅ No products are overlapping segment breaks`);
    }

    return overlappingProducts;
}

async function processAllSegmentBreaks(targetDoc) {
    console.log("🎯 PROCESSING ALL SEGMENT BREAKS SEQUENTIALLY...\n");

    const pog = targetDoc.data.planogram;
    const segments = Array.from(pog.segments).sort((a, b) => a.uiX - b.uiX);

    console.log(`📊 Found ${segments.length} segments to process`);

    // Process each adjacent pair of segments
    for (let i = 0; i < segments.length - 1; i++) {
        const currentSegment = segments[i];
        const nextSegment = segments[i + 1];
        const segmentBreakNumber = i + 1;

        console.log(`\n${"=".repeat(80)}`);
        console.log(`🔍 PROCESSING SEGMENT BREAK ${segmentBreakNumber}: Segment ${i + 1} → Segment ${i + 2}`);
        console.log(`   📍 Break at X=${(currentSegment.uiX + currentSegment.width).toFixed(3)}m`);
        console.log(`${"=".repeat(80)}`);

        // Lock current segment (skip first segment as it's already locked)
        if (i > 0) {
            await setSegmentCanCombineNo(targetDoc, currentSegment, i + 1);
            pog.updateNodes();
            await sleep(100);
        }

        // Check for overlaps at this specific segment break
        await checkSpecificSegmentBreakOverlaps(targetDoc, currentSegment, nextSegment, segmentBreakNumber);

        // Process overlaps with re-check loop (products may shift after moves)
        let iterationCount = 0;
        const MAX_ITERATIONS = 3; // Prevent infinite loops

        while (iterationCount < MAX_ITERATIONS) {
            const currentOverlaps = await checkSpecificSegmentBreakOverlaps(targetDoc, currentSegment, nextSegment, segmentBreakNumber, iterationCount > 0);

            if (!currentOverlaps || currentOverlaps.length === 0) {
                console.log(`✅ No overlaps found${iterationCount > 0 ? ' after ' + iterationCount + ' iteration(s)' : ''}`);
                break;
            }

            console.log(`🔄 Processing ${currentOverlaps.length} overlaps (iteration ${iterationCount + 1})...`);
            await handleOverlapScenariosSequential(targetDoc, currentOverlaps, currentSegment, nextSegment, segmentBreakNumber);

            iterationCount++;
        }

        // Final verification
        const finalCheck = await checkSpecificSegmentBreakOverlaps(targetDoc, currentSegment, nextSegment, segmentBreakNumber, true);

        if (finalCheck && finalCheck.length > 0) {
            console.log(`\n❌ CRITICAL ERROR: SCENARIOS FAILED TO RESOLVE ALL OVERLAPS!`);
            console.log(`   🚨 ${finalCheck.length} products still overlapping segment break ${segmentBreakNumber}`);
            finalCheck.forEach((pos, index) => {
                console.log(`      ${index + 1}. ${pos.product.upc} - Scenarios unable to resolve`);
            });
            throw new Error(`Scenarios failed to resolve ${finalCheck.length} overlaps at segment break ${segmentBreakNumber}`);
        }

        console.log(`\n✅ SEGMENT BREAK ${segmentBreakNumber} SUCCESSFULLY PROCESSED`);
        console.log(`   🎉 All overlaps resolved`);

        // Log current state of these two segments and check for displacement
        console.log(`\n${"=".repeat(80)}`);
        console.log(`📋 POST-PROCESSING: Segments ${i + 1} & ${i + 2} Current State`);
        console.log(`${"=".repeat(80)}`);
        const currentSnapshot = logSegmentProducts(targetDoc, { mode: 'two', segmentIndices: [i, i + 1], detailLevel: 'summary' }); console.log(`${"=".repeat(80)}`);

        // Compare against original snapshot
        console.log(`\n${"=".repeat(80)}`);
        console.log(`🔍 DISPLACEMENT CHECK: Segments ${i + 1} & ${i + 2}`);
        console.log(`${"=".repeat(80)}`);
        const displacedProducts = compareAgainstOriginalSnapshot(
            targetDoc._originalProductSnapshot,
            currentSnapshot,
            i + 1,
            i + 2
        );

        if (displacedProducts.length === 0) {
            console.log("✅ No products displaced from their original segments");
        } else {
            console.log(`🚨 ${displacedProducts.length} PRODUCTS DISPLACED:\n`);
            displacedProducts.forEach(product => {
                const shortUPC = product.upc.slice(-6);
                console.log(`  Segment ${product.beforeSegment} Fixture ${product.beforeFixture} → Segment ${product.afterSegment} Fixture ${product.afterFixture}: ${shortUPC}`);
            });

            // Attempt to rescue displaced products
            await rescueDisplacedProducts(targetDoc, displacedProducts, currentSegment, nextSegment, segmentBreakNumber);
        }
        console.log(`${"=".repeat(80)}\n`);

        console.log(`   Proceeding to next segment...`);
        await sleep(500); // Allow system to stabilize
    }

    console.log(`\n🎉 ALL SEGMENT BREAKS PROCESSED SUCCESSFULLY!`);
    console.log(`   ✅ ${segments.length - 1} segment breaks checked and resolved`);
}

async function setSegmentCanCombineNo(targetDoc, segment, segmentNumber) {
    // If no segment provided, find and lock first segment
    if (!segment) {
        console.log("🔒 Setting first segment fixtures to canCombine = 0 (NO)...");
        
        const pog = targetDoc.data.planogram;
        const segments = Array.from(pog.segments);
        const fixtures = Array.from(pog.fixtures);

        if (segments.length === 0) {
            console.log("   ⚠️ No segments found in planogram");
            return;
        }

        const firstSegment = segments.sort((a, b) => a.uiX - b.uiX)[0];
        segment = firstSegment;
        segmentNumber = 1;
        
        console.log(`   🎯 First segment found at X: ${firstSegment.uiX.toFixed(3)}m`);
    } else {
        console.log(`🔒 Setting segment ${segmentNumber} fixtures to canCombine = 0 (NO)...`);
    }

    const fixtures = Array.from(targetDoc.data.planogram.fixtures);
    const segmentLeft = segment.uiX;
    const segmentRight = segment.uiX + segment.width;

    const segmentFixtures = fixtures.filter(fixture => {
        const fixtureX = fixture.uiX;
        return fixtureX >= segmentLeft && fixtureX < segmentRight;
    });

    console.log(`   🏢 Found ${segmentFixtures.length} fixtures in segment ${segmentNumber}`);

    let updatedFixtures = 0;
    segmentFixtures.forEach(fixture => {
        fixture.canCombine = 0;
        updatedFixtures++;
    });

    console.log(`✅ Set canCombine = 0 for ${updatedFixtures} fixtures in segment ${segmentNumber}`);
    if (segmentNumber === 1) {
        console.log(`   🛡️ First segment is now locked - fixtures cannot combine`);
    }
}

async function checkSpecificSegmentBreakOverlaps(targetDoc, currentSegment, nextSegment, segmentBreakNumber, isFinalCheck = false) {
    const checkType = isFinalCheck ? "FINAL VERIFICATION" : "INITIAL CHECK";
    const posits = targetDoc.data.planogram.positions;
    const segmentBreakPoint = currentSegment.uiX + currentSegment.width;

    // Find products that are ACTUALLY spanning the segment break
    const bufferZone = 0.005; // 5mm tolerance - matches split calculation buffer - avoid false positives 
    const stillOverlapping = posits.filter(pos => {
        const productLeft = pos.uiX;
        const productRight = pos.uiX + (pos.facings.x * pos.merchSize.x);

        // Product must START before the boundary (with buffer)
        const startsInCurrentSegment = productLeft < (segmentBreakPoint - bufferZone);

        // Product must END after the boundary (with tolerance)
        const endsInNextSegment = productRight > (segmentBreakPoint + bufferZone);

        return startsInCurrentSegment && endsInNextSegment;
    });
    // Only log if there are overlaps OR final verification
    if (stillOverlapping.length > 0 || isFinalCheck) {
        console.log(`\n🔍 ${checkType}: Segment Break ${segmentBreakNumber} overlaps...`);
        console.log(`   📍 Current segment: X=${currentSegment.uiX.toFixed(3)}m to ${segmentBreakPoint.toFixed(3)}m`);
        console.log(`   📍 Next segment: X=${nextSegment.uiX.toFixed(3)}m to ${(nextSegment.uiX + nextSegment.width).toFixed(3)}m`);
        console.log(`🚨 SEGMENT BREAK ${segmentBreakNumber} OVERLAPS (${checkType}):`);
        console.log(`   📊 Products overlapping: ${stillOverlapping.length}`);
    }

    if (stillOverlapping.length > 0) {
        console.log(`   📋 Overlapping product UPCs:`);
        stillOverlapping.forEach((pos, index) => {
            const overhang = (pos.uiX + (pos.facings.x * pos.merchSize.x)) - segmentBreakPoint;
            console.log(`      ${index + 1}. ${pos.product.upc} (extends ${(overhang * 1000).toFixed(1)}mm into next segment)`);
        });
    } else {
        console.log(`   ✅ No products overlapping segment break ${segmentBreakNumber}!`);
    }

    return stillOverlapping;
}

// #endregion

// #region FACING INFLATION FOR LAST TWO SEGMENTS

// Phases have redundancies, but not worth the risk to condense
async function inflateFacingsInLastTwoSegments(targetDoc) {
    console.log("\n" + "=".repeat(80));
    console.log("📈 FACING INFLATION: Last Two Segments Cross-Segment Analysis");
    console.log("=".repeat(80));

    const pog = targetDoc.data.planogram;
    const segments = Array.from(pog.segments).sort((a, b) => a.uiX - b.uiX);

    if (segments.length < 2) {
        console.log("⚠️ Not enough segments for inflation logic (need at least 2)");
        return;
    }

    // Get last two segments
    const lastTwoSegments = segments.slice(-2);
    const segment9 = lastTwoSegments[0];
    const segment10 = lastTwoSegments[1];
    const actualSegment9Index = segments.indexOf(segment9);
    const actualSegment10Index = segments.indexOf(segment10);

    const segment9Left = segment9.uiX;
    const segment9Right = segment9.uiX + segment9.width;
    const segment10Right = segment10.uiX + segment10.width;

    console.log(`🎯 Targeting segments: ${actualSegment9Index + 1} and ${actualSegment10Index + 1}`);
    console.log(`   Segment ${actualSegment9Index + 1}: X=[${segment9Left.toFixed(3)}m to ${segment9Right.toFixed(3)}m]`);
    console.log(`   Segment ${actualSegment10Index + 1}: X=[${segment10.uiX.toFixed(3)}m to ${segment10Right.toFixed(3)}m]`);
    console.log(`   🚨 CRITICAL: Segment 10 right boundary at ${segment10Right.toFixed(3)}m - HARD LIMIT`);

    // Get all Y levels (shelves)
    const allPositions = Array.from(pog.positions);
    const allYValues = allPositions
        .map(p => Math.round(p.transform.worldPos.y * 100) / 100)
        .filter(y => typeof y === "number" && !isNaN(y));
    const yLevels = Array.from(new Set(allYValues)).sort((a, b) => b - a);

    console.log(`📊 Found ${yLevels.length} shelf levels to process\n`);

    // Process each shelf level across BOTH segments
    for (let shelfIndex = 0; shelfIndex < yLevels.length; shelfIndex++) {
        const yLevel = yLevels[shelfIndex];

        console.log(`\n${"=".repeat(80)}`);
        console.log(`🗃️ SHELF ${shelfIndex} (Y=${yLevel.toFixed(3)}m) - CROSS-SEGMENT ANALYSIS`);
        console.log("=".repeat(80));

        // Initialize counters for two-phase inflation
        let inflationCount = 0;
        const MAX_ITERATIONS = 50;

        // PHASE 1: Segment 11 inflation with cascade protection
        console.log(`\n   🎯 PHASE 1: Attempting segment ${actualSegment9Index + 1} inflation`);
        let segment11InflationAttempts = 0;
        const MAX_SEG11_ATTEMPTS = 20;
        let segment11Blocked = false;

        while (segment11InflationAttempts < MAX_SEG11_ATTEMPTS && !segment11Blocked) {
            const freshPositions = Array.from(pog.positions);

            const segment9Products = freshPositions.filter(pos => {
                const posY = pos.transform.worldPos.y;
                const posX = pos.uiX;
                const isCorrectShelf = Math.abs(posY - yLevel) < 0.05;
                const isInSegment9 = posX >= segment9Left && posX < segment9Right;
                return isCorrectShelf && isInSegment9 && pos.parent !== null;
            });

            const segment10Products = freshPositions.filter(pos => {
                const posY = pos.transform.worldPos.y;
                const posX = pos.uiX;
                const isCorrectShelf = Math.abs(posY - yLevel) < 0.05;
                const isInSegment10 = posX >= segment10.uiX && posX < segment10Right;
                return isCorrectShelf && isInSegment10 && pos.parent !== null;
            });

            if (segment9Products.length === 0) {
                console.log("   ℹ️ No products in segment 11");
                break;
            }

            // Calculate segment 10 space
            const segment10RightmostEdge = segment10Products.length > 0
                ? Math.max(...segment10Products.map(pos => pos.uiX + (pos.facings.x * pos.merchSize.x)))
                : segment10.uiX;

            const actualAvailableSpace = segment10Right - segment10RightmostEdge;

            if (actualAvailableSpace < 0.03) {
                console.log("   ⚠️ Segment 12 nearly full - stopping segment 11 inflation");
                segment11Blocked = true;
                break;
            }

            const seg11WithDOS = buildInflationCandidates(segment9Products, true)
                .filter(p => p.dos < 999);

            if (seg11WithDOS.length === 0) {
                console.log("   ℹ️ No segment 11 products with valid DOS");
                break;
            }

            const lowestDOSProduct = seg11WithDOS.sort((a, b) => a.dos - b.dos)[0];

            // Skip inflation if DOS is already 3.5 or greater
            if (lowestDOSProduct.dos >= 3.5) {
                console.log(`   ⚠️ Product ${lowestDOSProduct.upc.slice(-6)} has sufficient DOS (${lowestDOSProduct.dos.toFixed(2)}) - stopping inflation`);
                segment11Blocked = true;
                break;
            }

            const singleFacingWidth = lowestDOSProduct.position.merchSize.x / lowestDOSProduct.currentFacings;

            if (singleFacingWidth > actualAvailableSpace - 0.075) {
                console.log(`      ⚠️ Not enough space in segment 12`);
                segment11Blocked = true;
                break;
            }

            // PRE-FLIGHT CHECK
            console.log(`      🔍 PRE-FLIGHT: Cascade check...`);
            const seg10CurrentSpace = segment10Right - segment10RightmostEdge;

            if (seg10CurrentSpace < 0.15) {
                console.log(`         ⚠️ Segment 12 nearly full (${(seg10CurrentSpace * 1000).toFixed(1)}mm)`);
                console.log(`         🚫 PRE-FLIGHT FAILED: Blocking all segment 11 inflation`);
                segment11Blocked = true;
                break;
            }

            const segmentMidpoint = segment9Left + ((segment9Right - segment9Left) / 2);
            const seg9RightHalfProducts = segment9Products.filter(pos =>
                pos.uiX >= segmentMidpoint
            );

            if (seg9RightHalfProducts.length > 0) {
                const totalCascadableWidth = seg9RightHalfProducts.reduce((sum, pos) =>
                    sum + (pos.facings.x * pos.merchSize.x), 0
                );

                const requiredSafetySpace = singleFacingWidth + (totalCascadableWidth * 0.3);

                console.log(`         • Cascadable width: ${(totalCascadableWidth * 1000).toFixed(1)}mm`);
                console.log(`         • Required safety: ${(requiredSafetySpace * 1000).toFixed(1)}mm`);
                console.log(`         • Available: ${(seg10CurrentSpace * 1000).toFixed(1)}mm`);

                if (requiredSafetySpace > seg10CurrentSpace - 0.05) {
                    console.log(`      🚫 PRE-FLIGHT FAILED: Cascade risk - blocking all segment 11 inflation`);
                    segment11Blocked = true;
                    break;
                }
                console.log(`      ✅ PRE-FLIGHT PASSED`);
            }

            // INFLATE SEGMENT 11 PRODUCT
            const oldFacings = lowestDOSProduct.currentFacings;
            lowestDOSProduct.position.facings.x = oldFacings + 1;
            console.log(`      ✅ Inflated: ${oldFacings} → ${oldFacings + 1}`);

            if (lowestDOSProduct.position.fixture) {
                lowestDOSProduct.position.fixture.layoutByRank();
                await sleep(100);
            }

            pog.updateNodes();
            await sleep(150);

            // Check for overlaps
            console.log(`      🔍 Checking overlaps...`);
            const overlapCheckPositions = Array.from(pog.positions);
            const overlappingProducts = overlapCheckPositions.filter(pos => {
                if (Math.abs(pos.transform.worldPos.y - yLevel) >= 0.05) return false;
                if (!pos.fixture || pos.fixture.uiX < segment9Left || pos.fixture.uiX >= segment9Right) return false;

                const positionRight = pos.uiX + (pos.facings.x * pos.merchSize.x);
                return positionRight > segment9Right;
            });

            if (overlappingProducts.length > 0) {
                console.log(`      🚨 OVERLAP: ${overlappingProducts.length} products`);
                await handleOverlapScenariosSequential(targetDoc, overlappingProducts, segment9, segment10, actualSegment9Index + 1);
                pog.updateNodes();
                await sleep(150);
                console.log(`      ✅ Overlaps resolved`);
            }

            segment11InflationAttempts++;
            inflationCount++;
            await sleep(200);
        }

        if (segment11Blocked) {
            console.log(`\n   🛑 PHASE 1 COMPLETE: Segment ${actualSegment9Index + 1} inflation blocked by cascade risk`);
        } else {
            console.log(`\n   ✅ PHASE 1 COMPLETE: Segment ${actualSegment9Index + 1} inflation finished (${segment11InflationAttempts} facings added)`);
        }

        // PHASE 2: Segment 12 inflation (no cascade risk)
        console.log(`\n   🎯 PHASE 2: Attempting segment ${actualSegment10Index + 1} inflation (no cascade checks needed)`);
        let segment12InflationAttempts = 0;
        const MAX_SEG12_ATTEMPTS = 30;

        while (segment12InflationAttempts < MAX_SEG12_ATTEMPTS && inflationCount < MAX_ITERATIONS) {
            const freshPositions = Array.from(pog.positions);

            const segment10Products = freshPositions.filter(pos => {
                const posY = pos.transform.worldPos.y;
                const posX = pos.uiX;
                const isCorrectShelf = Math.abs(posY - yLevel) < 0.05;
                const isInSegment10 = posX >= segment10.uiX && posX < segment10Right;
                return isCorrectShelf && isInSegment10 && pos.parent !== null;
            });

            if (segment10Products.length === 0) {
                console.log("   ℹ️ No products in segment 12");
                break;
            }

            // Calculate remaining space
            const segment10RightmostEdge = Math.max(...segment10Products.map(pos =>
                pos.uiX + (pos.facings.x * pos.merchSize.x)
            ));

            const actualAvailableSpace = segment10Right - segment10RightmostEdge;

            if (actualAvailableSpace < 0.03) {
                console.log("   ⚠️ Insufficient space (< 30mm)");
                break;
            }

            const seg12WithDOS = buildInflationCandidates(segment10Products, true)
                .filter(p => p.dos < 999);

            if (seg12WithDOS.length === 0) {
                console.log("   ℹ️ No segment 12 products with valid DOS");
                break;
            }

            const lowestDOSProduct = seg12WithDOS.sort((a, b) => a.dos - b.dos)[0];

            // Skip inflation if DOS is already 3.5 or greater
            if (lowestDOSProduct.dos >= 3.5) {
                console.log(`   ⚠️ Product ${lowestDOSProduct.upc.slice(-6)} has sufficient DOS (${lowestDOSProduct.dos.toFixed(2)}) - stopping inflation`);
                break;
            }

            const singleFacingWidth = lowestDOSProduct.position.merchSize.x / lowestDOSProduct.currentFacings;

            if (singleFacingWidth > actualAvailableSpace - 0.075) {
                console.log(`      ⚠️ Facing too wide (${(singleFacingWidth * 1000).toFixed(1)}mm)`);
                break;
            }

            // INFLATE SEGMENT 12 PRODUCT (no pre-flight needed)
            const oldFacings = lowestDOSProduct.currentFacings;
            lowestDOSProduct.position.facings.x = oldFacings + 1;
            console.log(`      ✅ Inflated: ${oldFacings} → ${oldFacings + 1}`);

            if (lowestDOSProduct.position.fixture) {
                lowestDOSProduct.position.fixture.layoutByRank();
                await sleep(100);
            }

            pog.updateNodes();
            await sleep(150);

            segment12InflationAttempts++;
            inflationCount++;
            await sleep(200);
        }

        console.log(`\n   ✅ PHASE 2 COMPLETE: Segment ${actualSegment10Index + 1} (${segment12InflationAttempts} facings added)`);
        if (inflationCount > 0) {
            console.log(`\n   ✅ Shelf ${shelfIndex}: ${inflationCount} facings added`);
        } else {
            console.log(`   ℹ️ No facings added to shelf ${shelfIndex}`);
        }
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ FACING INFLATION COMPLETE");
    console.log("=".repeat(80) + "\n");
}
// #endregion

// #region FILL REMAINING SPACE IN LAST SEGMENT

async function fillRemainingSpaceInLastSegment(targetDoc) {
    console.log("\n" + "=".repeat(80));
    console.log("📦 FILLING REMAINING SPACE IN LAST SEGMENT");
    console.log("=".repeat(80));

    const pog = targetDoc.data.planogram;
    const segments = Array.from(pog.segments).sort((a, b) => a.uiX - b.uiX);

    if (segments.length === 0) {
        console.log("⚠️ No segments found in planogram");
        return;
    }

    const lastSegment = segments.reduce((rightmost, seg) => {
        return seg.uiX > rightmost.uiX ? seg : rightmost;
    });
    console.log(`📍 Identified rightmost (last) segment at X=${lastSegment.uiX.toFixed(3)}m`); const lastSegmentLeft = lastSegment.uiX;
    const lastSegmentRight = lastSegment.uiX + lastSegment.width;

    console.log(`🎯 Last segment: X=${lastSegmentLeft.toFixed(3)}m to ${lastSegmentRight.toFixed(3)}m`);
    console.log(`📏 Last segment width: ${(lastSegment.width * 1000).toFixed(1)}mm\n`);

    // Get all fixtures in last segment
    const allFixtures = Array.from(pog.fixtures);
    const lastSegmentFixtures = allFixtures.filter(fixture => {
        const fixtureX = fixture.uiX;
        return fixtureX >= lastSegmentLeft && fixtureX < lastSegmentRight;
    }).sort((a, b) => a.uiX - b.uiX);

    console.log(`🏢 Found ${lastSegmentFixtures.length} fixtures in last segment\n`);

    if (lastSegmentFixtures.length === 0) {
        console.log("⚠️ No fixtures found in last segment");
        return;
    }

    let totalFacingsAdded = 0;

    // Process each fixture independently
    for (let fixtureIndex = 0; fixtureIndex < lastSegmentFixtures.length; fixtureIndex++) {
        const fixture = lastSegmentFixtures[fixtureIndex];
        const fixtureNumber = fixtureIndex + 1;

        console.log("=".repeat(80));
        console.log(`🏗️ FIXTURE ${fixtureNumber}/${lastSegmentFixtures.length}`);
        console.log("=".repeat(80));
        console.log(`📍 Position: X=${fixture.uiX.toFixed(3)}m to ${(fixture.uiX + fixture.width).toFixed(3)}m`);
        console.log(`📏 Fixture width: ${(fixture.width * 1000).toFixed(1)}mm`);

        // Get all Y levels (shelves) on this fixture
        const fixturePositions = Array.from(pog.positions).filter(pos =>
            pos.fixture?.uuid === fixture.uuid
        );

        if (fixturePositions.length === 0) {
            console.log(`   ℹ️ No products on this fixture\n`);
            continue;
        }

        // Group products by Y level
        const productsByShelf = {};
        fixturePositions.forEach(pos => {
            const shelfY = Math.round(pos.transform.worldPos.y * 100) / 100;
            (productsByShelf[shelfY] = productsByShelf[shelfY] || []).push(pos);
        });

        const yLevels = Object.keys(productsByShelf).sort((a, b) => parseFloat(b) - parseFloat(a));
        console.log(`📊 ${yLevels.length} shelf levels found on this fixture\n`);

        // Process each Y level (shelf) independently
        for (let shelfIndex = 0; shelfIndex < yLevels.length; shelfIndex++) {
            const yLevel = parseFloat(yLevels[shelfIndex]);
            const shelfNumber = shelfIndex + 1;

            console.log(`   ${"─".repeat(70)}`);
            console.log(`   🗃️ SHELF ${shelfNumber}/${yLevels.length} (Y=${yLevel.toFixed(3)}m)`);
            console.log(`   ${"─".repeat(70)}`);

            let shelfFacingsAdded = 0;
            let iterationCount = 0;
            const MAX_ITERATIONS = 50; // Prevent infinite loops

            // Keep trying to add facings until no more space
            while (iterationCount < MAX_ITERATIONS) {
                iterationCount++;

                // Recalculate available space
                const freshPositions = Array.from(pog.positions);
                const shelfProducts = freshPositions.filter(pos =>
                    pos.fixture?.uuid === fixture.uuid &&
                    Math.abs(pos.transform.worldPos.y - yLevel) < 0.01
                );

                if (shelfProducts.length === 0) {
                    console.log(`      ⚠️ No products on this shelf (unexpected)`);
                    break;
                }

                // Calculate available space
                const totalProductWidth = shelfProducts.reduce((sum, pos) =>
                    sum + (pos.facings.x * pos.merchSize.x), 0
                );
                const availableSpace = fixture.width - totalProductWidth;

                if (availableSpace < 0.020) { // Less than 20mm
                    console.log(`      ✅ Shelf is full (< 20mm remaining)`);
                    break;
                }

              // Calculate DOS for all products on this shelf
                const productsWithMetrics = buildInflationCandidates(shelfProducts, true);

                // Use helper to select product
                const selection = selectProductForInflation(productsWithMetrics, availableSpace);
                
                if (!selection) {
                    console.log(`      ⚠️ No products fit in remaining space`);
                    break;
                }
                
                const selectedProduct = selection.product;
                const strategy = selection.reason;
                
                // Log selection
                const validDOSProducts = productsWithMetrics.filter(p => p.dos < 999);
                if (validDOSProducts.length === 0) {
                    console.log(`\n      ℹ️ All products have N/A DOS - using smallest width strategy`);
                    console.log(`      ✅ Selected: ...${selectedProduct.upc.slice(-6)} - ${strategy}`);
                } else {
                    if (strategy.includes('LOWEST_DOS')) {
                        console.log(`         ✅ STRATEGY 1 ACCEPTED`);
                    } else {
                        console.log(`         ❌ STRATEGY 1 REJECTED: Doesn't fit`);
                        console.log(`         ✅ STRATEGY 2 ACCEPTED`);
                    }
                }
                // Inflate the selected product
                if (selectedProduct) {
                    const oldFacings = selectedProduct.currentFacings;
                    selectedProduct.pos.facings.x = oldFacings + 1;

                    console.log(`\n      ➕ INFLATING: ...${selectedProduct.upc.slice(-6)}`);
                    console.log(`         ${oldFacings} → ${oldFacings + 1} facings`);
                    console.log(`         Reason: ${strategy}`);

                    // Apply layout changes
                    if (selectedProduct.pos.fixture) {
                        selectedProduct.pos.fixture.layoutByRank();
                        await sleep(100);
                    }

                    pog.updateNodes();
                    await sleep(150);

                    // Verify no overflow
                    const verifyPositions = Array.from(pog.positions);
                    const rightmostEdge = Math.max(...verifyPositions
                        .filter(pos => pos.fixture?.uuid === fixture.uuid && Math.abs(pos.transform.worldPos.y - yLevel) < 0.01)
                        .map(pos => pos.uiX + (pos.facings.x * pos.merchSize.x)));

                    const overflow = rightmostEdge - (fixture.uiX + fixture.width);

                    if (overflow > 0.001) {
                        console.log(`      ❌ OVERFLOW ${(overflow * 1000).toFixed(1)}mm - undoing`);
                        selectedProduct.pos.facings.x = oldFacings;
                        selectedProduct.pos.fixture.layoutByRank();
                        await sleep(100);
                        pog.updateNodes();
                        await sleep(150);
                        break;
                    }

                    shelfFacingsAdded++;
                    totalFacingsAdded++;
                    console.log(`      ✅ Inflation complete - recalculating for next iteration...`);
                } else {
                    break;
                }
            }

            if (shelfFacingsAdded > 0) {
                console.log(`\n   ✅ Shelf ${shelfNumber} complete: ${shelfFacingsAdded} facings added`);
            } else {
                console.log(`\n   ℹ️ Shelf ${shelfNumber} complete: No facings added (already full)`);
            }
        }

        console.log(`\n✅ Fixture ${fixtureNumber} complete\n`);
    }

    console.log("=".repeat(80));
    console.log(`✅ FILL REMAINING SPACE COMPLETE`);
    console.log(`   Total facings added across all fixtures: ${totalFacingsAdded}`);
    console.log("=".repeat(80) + "\n");
}

// #endregion

// #region OVERLAP SCENARIO HANDLING

async function handleOverlapScenariosSequential(targetDoc, remainingOverlaps, currentSegment, nextSegment, segmentBreakNumber) {
    console.log(`🎯 PROCESSING ${remainingOverlaps.length} OVERLAPPING PRODUCTS WITH SEQUENTIAL SCENARIOS...\n`);

    const segmentBreakPoint = currentSegment.uiX + currentSegment.width;

    for (let i = 0; i < remainingOverlaps.length; i++) {
        const pos = remainingOverlaps[i];
        console.log(`\n📦 PRODUCT ${i + 1}/${remainingOverlaps.length}: ${pos.product.upc} (Segment Break ${segmentBreakNumber})`);
        console.log(`   📊 SEGMENT BREAK: ${segmentBreakPoint.toFixed(3)}m`);

        // Analyze which scenario applies to this product
        const scenario = analyzeOverlapScenario(pos, segmentBreakPoint);
        console.log(`   📊 Analysis: ${scenario.percentageInLeft.toFixed(1)}% in current segment`);

        let scenarioHandled = false;

        // SCENARIO 1: Single facing products with 50%+ left attachment
        if (!scenarioHandled && scenario.type === "50_PERCENT_LEFT_ATTACHMENT" && pos.facings.x === 1) {
            console.log(`   🎯 APPLYING SCENARIO 1: 50% Left Attachment (Single facing product)`);
            const success = await handleFiftyPercentLeftAttachment(targetDoc, pos, nextSegment);
            if (success) {
                scenarioHandled = true;
                console.log(`   ✅ SCENARIO 1 SUCCESS: Product resolved`);
            } else {
                console.log(`   ❌ SCENARIO 1 FAILED: Trying next scenario...`);
            }
        }

        // SCENARIO 2: Multi-facing products - try splitting facings first
        if (!scenarioHandled && pos.facings.x >= 2) {
            console.log(`   🎯 MULTI-FACING PRODUCT DETECTED: ${pos.facings.x} facings - checking split feasibility`);

            // Check if next segment is the last segment
            const pog = targetDoc.data.planogram;
            const allSegments = Array.from(pog.segments).sort((a, b) => a.uiX - b.uiX);
            const isNextSegmentLast = nextSegment === allSegments[allSegments.length - 1];

            if (isNextSegmentLast) {
                console.log(`   🚫 LAST SEGMENT DETECTED: Splitting disabled - all facings must stay together`);
                console.log(`   🎯 Moving entire product to last segment instead...`);

                const success = await handleFiftyPercentLeftAttachment(targetDoc, pos, nextSegment);
                if (success) {
                    scenarioHandled = true;
                    console.log(`   ✅ ENTIRE PRODUCT MOVED: All ${pos.facings.x} facings moved to last segment`);
                } else {
                    console.log(`   ❌ MOVE FAILED: Unable to move product to last segment`);
                }
            } else {

                const productLeft = pos.uiX;
                const productCurrentWidth = pos.facings.x * pos.merchSize.x;

                const realSingleFacingWidth = productCurrentWidth / pos.facings.x;
                const bufferZone = 0.005; // 5mm safety buffer
                const effectiveSegmentBoundary = segmentBreakPoint - bufferZone;
                const spaceRemainingToSegmentBoundary = effectiveSegmentBoundary - productLeft;
                const facingsThatFitInRemainingSpace = Math.floor((spaceRemainingToSegmentBoundary / realSingleFacingWidth) + 0.001);

                // Attempt splitting if feasible
                if (facingsThatFitInRemainingSpace >= 1 && facingsThatFitInRemainingSpace < pos.facings.x) {
                    console.log(`   🎯 APPLYING SCENARIO 2: Split Facings (${facingsThatFitInRemainingSpace} left + ${pos.facings.x - facingsThatFitInRemainingSpace} right)`);

                    const splitScenario = {
                        type: "SPLIT_FACINGS",
                        totalFacings: pos.facings.x,
                        facingsThatFitLeft: facingsThatFitInRemainingSpace,
                        facingsForRight: pos.facings.x - facingsThatFitInRemainingSpace,
                        singleFacingWidth: realSingleFacingWidth
                    };

                    const success = await handleSplitFacings(targetDoc, pos, nextSegment, splitScenario);
                    if (success) {
                        scenarioHandled = true;
                        console.log(`   ✅ SCENARIO 2 SUCCESS: Facings split and placed`);
                    } else {
                        console.log(`   ❌ SCENARIO 2 FAILED: Trying next scenario...`);
                    }
                } else if (facingsThatFitInRemainingSpace >= pos.facings.x) {
                    console.log(`   ℹ️ ALL FACINGS FIT: Product should not be overlapping`);
                    console.log(`   🔍 Possible issue: Product positioning or segment boundary calculation`);
                } else {
                    console.log(`   ⚠️ SPLIT NOT FEASIBLE: Only ${facingsThatFitInRemainingSpace} facings fit, trying entire product move...`);

                    // Fallback: move entire product
                    const success = await handleFiftyPercentLeftAttachment(targetDoc, pos, nextSegment);
                    if (success) {
                        scenarioHandled = true;
                        console.log(`   ✅ FALLBACK SUCCESS: Entire product moved to next segment`);
                    } else {
                        console.log(`   ❌ FALLBACK FAILED: Unable to resolve product placement`);
                    }
                }
            }
        }

        // SCENARIO 1B: Multi-facing products that can't be split
        if (!scenarioHandled && scenario.type === "50_PERCENT_LEFT_ATTACHMENT") {
            console.log(`   🎯 APPLYING SCENARIO 1B: 50% Left Attachment (Fallback for unsplittable multi-facing)`);
            const success = await handleFiftyPercentLeftAttachment(targetDoc, pos, nextSegment);
            if (success) {
                scenarioHandled = true;
                console.log(`   ✅ SCENARIO 1B SUCCESS: Product resolved`);
            } else {
                console.log(`   ❌ SCENARIO 1B FAILED: Trying next scenario...`);
            }
        }

        // SCENARIO 3: Products with minority left attachment - move entire product right
        if (!scenarioHandled && scenario.type === "MINORITY_LEFT_ATTACHMENT") {
            console.log(`   🎯 APPLYING SCENARIO 3: Minority Left Attachment - Moving entire product to next segment`);
            const success = await handleFiftyPercentLeftAttachment(targetDoc, pos, nextSegment);
            if (success) {
                scenarioHandled = true;
                console.log(`   ✅ SCENARIO 3 SUCCESS: Product moved to next segment`);
            } else {
                console.log(`   ❌ SCENARIO 3 FAILED: Unable to move product`);
            }
        }

        if (!scenarioHandled) {
            console.log(`   ⚠️ NO APPLICABLE SCENARIO FOUND for ${pos.product.upc}`);
            console.log(`   🔍 Product will be flagged in final verification`);
        }

        await sleep(100);
    }

    console.log(`\n✅ FINISHED SEQUENTIAL SCENARIO PROCESSING`);
}

function analyzeOverlapScenario(pos, segmentBreakPoint) {
    const productLeft = pos.uiX;
    const productWidth = pos.facings.x * pos.merchSize.x;

    // Calculate how much of the product is in each segment
    const widthInLeftSegment = Math.max(0, segmentBreakPoint - productLeft);
    const percentageInLeftSegment = (widthInLeftSegment / productWidth) * 100;

    // Priority: Check if multi-facing product can be split
    if (pos.facings.x >= 2) {
        const singleFacingWidth = pos.merchSize.x / pos.facings.x;
        const availableWidthLeft = segmentBreakPoint - productLeft;
        const facingsThatFitLeft = Math.floor(availableWidthLeft / singleFacingWidth);

        // Return split scenario if partial split is possible
        if (facingsThatFitLeft >= 1 && facingsThatFitLeft < pos.facings.x) {
            console.log(`   🔍 MULTI-FACING DETECTED: ${pos.facings.x} facings, ${facingsThatFitLeft} can fit left`);
            return {
                type: "SPLIT_FACINGS",
                percentageInLeft: percentageInLeftSegment,
                widthInLeft: widthInLeftSegment,
                totalWidth: productWidth,
                totalFacings: pos.facings.x,
                facingsThatFitLeft: facingsThatFitLeft,
                facingsForRight: pos.facings.x - facingsThatFitLeft,
                singleFacingWidth: singleFacingWidth
            };
        }
    }

    // Determine attachment scenario based on left segment percentage
    if (percentageInLeftSegment >= 50) {
        return {
            type: "50_PERCENT_LEFT_ATTACHMENT",
            percentageInLeft: percentageInLeftSegment,
            widthInLeft: widthInLeftSegment,
            totalWidth: productWidth
        };
    } else {
        return {
            type: "MINORITY_LEFT_ATTACHMENT",
            percentageInLeft: percentageInLeftSegment,
            widthInLeft: widthInLeftSegment,
            totalWidth: productWidth
        };
    }
}

// #endregion

// #region SCENARIO IMPLEMENTATION FUNCTIONS

async function handleFiftyPercentLeftAttachment(targetDoc, originalPos, secondSegment) {
    console.log(`   🔧 EXECUTING: Duplicate and move to LEFTMOST AVAILABLE position in right segment...`);

    try {
        // Find appropriate fixture in target segment
        const targetFixture = findTargetFixtureInSegment(targetDoc, secondSegment, originalPos.fixture.position.y);

        if (!targetFixture) {
            console.log(`   ❌ ERROR: Could not find target fixture in second segment`);
            return false;
        }

        console.log(`   🏢 Target fixture found at Y=${targetFixture.position.y.toFixed(3)}m`);
        console.log(`   📍 Target fixture boundaries: X=${targetFixture.transform.worldPos.x.toFixed(3)}m to ${(targetFixture.transform.worldPos.x + targetFixture.width).toFixed(3)}m`);

        // Calculate optimal positioning
        const leftmostAvailableX = findLeftmostAvailablePosition(targetFixture);

        console.log(`   📏 Original position: ${originalPos.uiX.toFixed(3)}m`);
        console.log(`   🎯 LEFTMOST AVAILABLE position: ${(targetFixture.transform.worldPos.x + leftmostAvailableX).toFixed(3)}m (relative X=${leftmostAvailableX.toFixed(3)}m)`);

        // Create duplicate in new location
        const duplicatePos = await createDuplicatePosition(targetDoc, originalPos, targetFixture);

        if (!duplicatePos) {
            console.log(`   ❌ ERROR: Failed to create duplicate position`);
            return false;
        }

        // Configure duplicate positioning
        duplicatePos.position.x = leftmostAvailableX;
        duplicatePos.position.y = 0;
        duplicatePos.position.z = 0;
        duplicatePos.rank.x = 0.5; // Low rank for leftmost positioning

        // Apply layout changes
        targetFixture.layoutByRank();
        await sleep(50);

        // Remove original position
        console.log(`   🗑️ Deleting original position...`);
        originalPos.parent = null;

        // Final layout updates
        if (originalPos.fixture) {
            originalPos.fixture.layoutByRank();
        }
        targetFixture.layoutByRank();
        await sleep(100);

        console.log(`   ✅ SUCCESS: Product moved to LEFTMOST AVAILABLE position of right segment`);
        console.log(`   🎯 Sequential order maintained: ${originalPos.product.upc} positioned at start of sequence`);

        return true;

    } catch (error) {
        console.log(`   ❌ ERROR in handleFiftyPercentLeftAttachment: ${error.message}`);
        return false;
    }
}

async function handleSplitFacings(targetDoc, originalPos, nextSegment, scenario) {
    console.log(`   🔧 EXECUTING: Split ${scenario.totalFacings} facings → ${scenario.facingsThatFitLeft} left + ${scenario.facingsForRight} right...`);

    try {
        // Find target fixture for overflow facings
        const targetFixture = findTargetFixtureInSegment(targetDoc, nextSegment, originalPos.fixture.position.y);

        if (!targetFixture) {
            console.log(`   ❌ ERROR: Could not find target fixture in next segment`);
            return false;
        }

        console.log(`   🏢 Target fixture found for right-side facings`);

        // Calculate positioning for overflow facings
        const leftmostAvailableX = findLeftmostAvailablePosition(targetFixture);

        // Create duplicate for overflow facings
        const duplicatePos = await createDuplicatePosition(targetDoc, originalPos, targetFixture);

        if (!duplicatePos) {
            console.log(`   ❌ ERROR: Failed to create duplicate position`);
            return false;
        }

        // Configure duplicate for overflow facings only
        duplicatePos.facings.x = scenario.facingsForRight;
        duplicatePos.position.x = leftmostAvailableX;
        duplicatePos.position.y = 0;
        duplicatePos.position.z = 0;
        duplicatePos.rank.x = 0.5; // Low rank for leftmost positioning

        console.log(`   📍 Right-side duplicate: ${scenario.facingsForRight} facings at leftmost position`);

        // Reduce original product to remaining facings
        originalPos.facings.x = scenario.facingsThatFitLeft;

        console.log(`   📏 Left-side original: reduced to ${scenario.facingsThatFitLeft} facings`);

        // Apply layout changes to both fixtures
        targetFixture.layoutByRank();
        originalPos.fixture.layoutByRank();
        await sleep(100);

        // Verify split was successful
        const originalRight = originalPos.uiX + (originalPos.facings.x * (originalPos.merchSize.x / scenario.totalFacings));
        const segmentBreakPoint = originalPos.fixture.uiX + originalPos.fixture.width;

        if (originalRight <= segmentBreakPoint + 0.001) { // 1mm tolerance
            console.log(`   ✅ SUCCESS: Facings split successfully`);
            console.log(`      • Left: ${scenario.facingsThatFitLeft} facings in original segment`);
            console.log(`      • Right: ${scenario.facingsForRight} facings in next segment`);
            console.log(`      • No overlap remaining`);
            return true;
        } else {
            console.log(`   ⚠️ WARNING: Split may not have fully resolved overlap`);
            console.log(`      • Original right edge: ${originalRight.toFixed(3)}m`);
            console.log(`      • Segment break: ${segmentBreakPoint.toFixed(3)}m`);
            return false;
        }

    } catch (error) {
        console.log(`   ❌ ERROR in handleSplitFacings: ${error.message}`);
        return false;
    }
}

// #endregion

// #region HELPER FUNCTIONS

function findLeftmostAvailablePosition(fixture) {
    const existingPositions = Array.from(fixture.positions || []);

    if (existingPositions.length === 0) {
        return 0.005; // 5mm from left edge
    }

    // Sort by X position to find leftmost product
    const sortedPositions = existingPositions.sort((a, b) => a.position.x - b.position.x);
    const leftmostExisting = sortedPositions[0];
    const leftmostX = leftmostExisting.position.x;

    console.log(`   📍 Found ${existingPositions.length} existing products on fixture`);
    console.log(`   📍 Leftmost existing product at relative X: ${leftmostX.toFixed(3)}m`);

    // Place new product before leftmost existing product
    const newLeftmostX = Math.max(0.005, leftmostX - 0.01); // At least 5mm from edge, 10mm before existing

    console.log(`   🎯 Placing duplicate at X: ${newLeftmostX.toFixed(3)}m (before existing products)`);

    return newLeftmostX;
}

function findTargetFixtureInSegment(targetDoc, segment, targetY) {
    const allFixtures = Array.from(targetDoc.data.planogram.fixtures);
    const segmentLeft = segment.uiX;
    const segmentRight = segment.uiX + segment.width;

    // Find fixtures in segment at same Y level
    const candidateFixtures = allFixtures.filter(fixture => {
        const fixtureX = fixture.uiX;
        const fixtureY = fixture.position.y;
        const inSegment = fixtureX >= segmentLeft && fixtureX < segmentRight;
        const sameYLevel = Math.abs(fixtureY - targetY) < 0.05; // 5cm tolerance

        return inSegment && sameYLevel;
    });

    if (candidateFixtures.length > 0) {
        // Return leftmost fixture in segment at this Y level
        return candidateFixtures.sort((a, b) => a.uiX - b.uiX)[0];
    }

    return null;
}

async function createDuplicatePosition(targetDoc, originalPos, targetFixture) {
    try {

        // Create new position with EXPLICIT product reference only
        const duplicatePos = targetDoc.createByDef({
            type: "Position",
            product: originalPos.product,  // Direct product reference
            merchStyle: originalPos.merchStyle || 0
        }, targetFixture);

        if (duplicatePos) {

            // EXPLICITLY copy only the merchandising settings we want
            duplicatePos.facings.x = originalPos.facings.x;
            duplicatePos.facings.y = originalPos.facings.y;
            duplicatePos.facings.z = originalPos.facings.z;
            duplicatePos.merch.x.size.value = originalPos.merch.x.size.value;
            duplicatePos.merch.x.placement.value = originalPos.merch.x.placement.value;
            duplicatePos.merch.y.placement.value = originalPos.merch.y.placement.value;
            duplicatePos.merch.z.placement.value = originalPos.merch.z.placement.value;

        } else {
            console.log(`         ❌ Duplicate creation returned null`);
        }

        return duplicatePos;

    } catch (error) {
        console.log(`   ❌ Error creating duplicate: ${error.message}`);
        console.log(`   📚 Stack: ${error.stack}`);
        return null;
    }
}

// Checks if UPC splitting is allowed based on desc 13 configuration
function isUPCSplittingAllowed(targetDoc) {
    if (typeof targetDoc._allowUPCSplitting !== 'undefined') {
        return targetDoc._allowUPCSplitting;
    }

    return getCachedUPCSplittingConfig(targetDoc);
}

// #endregion

// #region SINGLE PLANOGRAM MODE

(async function () {
    const isInApp = typeof app !== 'undefined' && app.sys && app.sys.view;

    if (isInApp) {
        console.log("🧪 RUNNING IN SINGLE PLANOGRAM MODE");
        const targetDoc = app.sys.view.doc;
        await processDocument(targetDoc);
        console.log("🎉 Single planogram processing complete!");
    } else {
        console.log("⚡ MERCHANDISING SETTINGS SCRIPT LOADED - Ready for batch automation");
    }
})();

// #endregionn