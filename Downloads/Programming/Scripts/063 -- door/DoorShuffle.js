//#region VARIABLES
blockname = 'product.data.performanceDesc:39'
largerblock = 'product.data.performanceDesc:36'
dividerblocks = 'product.data.performanceDesc:37'
revistedblocks = 'product.data.performanceDesc:39'
dividerblocks2 = 'data.performanceDesc:37'
dipDividerBlock = 'data.performanceDesc:45'
assortAdd = 'product.data.performanceFlag:6'
pog_store_number = 'data.desc:49'
dividerWidth = in2M(0.0)
dividerTolerance = in2M(0.0)
dividerWidthWithT = dividerWidth + dividerTolerance // add a tolerance


// Template Groups with Size Bucket & Template uuid's 
// templates_014_v555_v560_Group = [
//   { size: 4, uuid: "619eeeec-ff22-4667-9c0f-1dbe04b79225" },
//   { size: 8, uuid: "23cd29ec-a3ef-4343-a484-31b6d8059219" },
//   { size: 12, uuid: "7d125657-a8f2-4b6a-b51f-9f8e19e5d906" },
//   { size: 16, uuid: "29dd3985-3dac-4d84-9751-ac81a5b5bba1" }
// ]


//define variables that can be called throughout the script and can change dynamically.
let newPosits = new Array();

let variables = {
  flexspace: 0.25
}

//#endregion


//#region RUN

const cWhite = 0xffffff;
const cRed = 0xff0000;
const cOrange = 0xff9900;
const cYellow = 0xffff00;
const cGreen = 0x00ff00;
const cBlue = 0x0000ff;

//Run Headless is usually called on by the Batch Script. Contains the list of functions and overarching rules that processes a Target.
//Typically, Opens file, assigns Template, performs various regions of the script, creates a New Folder, and saves the processed POG.
async function runHeadless(args) {
  let file = await VqUtils.getFile(args.targetUuid);
  if (file.fileType === "file") {
    let folder = await VqUtils.getFile(file.folderUuid);
    let parentFolder = await VqUtils.getFile(folder.folderUuid);
    let outputFolder = await getOrCreateFolder(parentFolder.uuid, `${folder.name} - 'processed - 1 shuffles 3 deep`)

    let controller = { signal: { aborted: false } }

    console.log(`Loading target for ${file.name}...`)
    let targetDoc = await loadDoc(file.uuid);


    // console.log('Fixing Segments...')

    // await renamePOGFlowFix(targetDoc)
    // await sleep(50)


    await sleep(100)
    //Check if the POG is a project POG. If yes, do not generate.
    let targTextBoxes = targetDoc.data.planogram.annotations
    let projectTextBoxCounter = targTextBoxes.reduce((total, item) => total + (item.text.includes("STOP") || item.text.includes("Stop") || item.text.includes("stop") ? 1 : 0), 0)
    console.log(projectTextBoxCounter != 0)
    if (Number(projectTextBoxCounter) === 0) {

      console.log(`Selecting Template...`)
      let targtotSize = targetDoc.data.planogram.width
      let targDivision = targetDoc.data.planogram.data.desc.get(39)
      let sspn = targetDoc.data.planogram.data.desc.get(37)
      // let targTempDirectory = targetDoc.data.planogram.data.createdBy
      //let targNotes = targetDoc.data.planogram.data.notes
      let tempGroup = await getTemplateSizesList(targDivision, sspn)
      console.log(tempGroup)
      console.log(meters2IN(targtotSize) / 12)
      let templateDocUUID = await getTemplateUUID2(targtotSize, tempGroup)

      if (!templateDocUUID) return

      console.log(templateDocUUID)


      console.log("Loading template...")
      let templateDoc = await loadDoc(templateDocUUID);
      console.log("Preparing...")
      await prepare(targetDoc, templateDoc);

      await sleep(1000)

      console.log("Optimising Initial...")
      await optimise(targetDoc, controller);


      await shuffleOnAllBlocks(targetDoc);

      // for (let p of targetDoc.data.planogram.positions) {
      //   p.facings.x = !p.product.data.performanceDesc.get(38).includes("S") ? 1 : 2
      // }

      // await sleep(500)

      // newPosits = new Array();

      await sleep(100)

      // console.log("Optimising Secondary...")
      // await optimise(targetDoc, controller);

      // await shuffleOnAllBlocks(targetDoc);

      newPosits = new Array();

      // await shuffleOnAllBlocks(targetDoc)

      console.log("Optimising Final...")
      await optimise(targetDoc, controller);

      // await shuffleOnAllBlocks(targetDoc);

      // console.log("Re Optimising Prepare...")
      // await reOptPrep(targetDoc)
      // console.log("Re Optimising...")
      // await reoptimise(targetDoc, controller);

      // console.log("Blocking...")
      // await blocking(targetDoc)

      // console.log("Re Optimising Prepare...")
      // await reOptPrep(targetDoc)
      // console.log("Re Optimising...")
      // await reoptimise(targetDoc, controller);

      // console.log("Sub Planogram Preparing...")
      // await subPlanogramPrepare(targetDoc, templateDoc);

      console.log("Tidying...")
      await tidy(targetDoc)


      //Checks if planogram is overallocated. If it is, it changes the file name and the Desc50(planogram) to reflect the overallocation prior to saving.
      console.log("Saving...")
      let outputBlob = await RplanUtils.export(targetDoc, "psa");

      if (targetDoc.data.planogram.data.desc.get(50) === "OVER-ALLOCATED") {
        await VqUtils.createFile(file.name.replace(".psa", " - OVERALLOCATED") + ".psa", outputFolder.uuid, outputBlob, true)
      } else {

        targetDoc.data.planogram.data.desc.set(50, "PROCESSED")

        await VqUtils.createFile(file.name, outputFolder.uuid, outputBlob, true)
      }
      console.log("Finished")
    } else {
      console.log("Project POG... Will Not Process")
    }
  }
}


// runLocal is archaic
async function runLocal() {
  const docs = Array.from(app.sys.windows.values()).map((w) => w.doc);
  const targetDoc = app.sys.view.doc;
  const templateDoc = docs.find(
    (d) => d !== targetDoc && d.data.planogram.positions.size > 0
  );

  let controller = new AbortController();

  await requireBothDocs(targetDoc, templateDoc)
  await prepare(targetDoc, templateDoc);
  await optimise(targetDoc, controller);
  await blocking(targetDoc)
  await tidy(targetDoc)
}

// run pertains to the rPlan UI only
async function run() {
  docs = Array.from(app.sys.windows.values()).map((w) => w.doc);
  targetDoc = app.sys.view.doc;
  templateDoc = docs.find(
    (d) => d !== targetDoc && d.data.planogram.positions.size > 0
  );

  let controller = new AbortController();

  const handleEvent = async (e) => {
    let receivedMessage = e.data;
    switch (receivedMessage.type) {
      case "update variable":
        variables[receivedMessage.key] = receivedMessage.value;
        break;
      case "getData":
        docs = Array.from(app.sys.windows.values()).map((w) => w.doc);
        targetDoc = app.sys.view.doc;
        templateDoc2 = docs.find(
          (d) => d !== targetDoc && d.data.planogram.positions.size > 0
        );
        if (templateDoc2)
          templateDoc = templateDoc2;

        let data = await getData(targetDoc)

        postMessage({ type: "createResults", data, variables: variables }, "*");
        break;
      case "run":
        switch (receivedMessage.step) {
          case "all":
            await requireBothDocs(targetDoc, templateDoc);
            await prepare(targetDoc, templateDoc);
            controller = new AbortController();
            await optimise(targetDoc, controller);
            if (controller.signal.aborted) break;
            await blocking(targetDoc)
            await tidy(targetDoc)
            break;
          case "load Template":
            if (!templateDoc) {
              templateDoc = await loadDoc("a536ff32-172f-481a-b519-1d1b67a7dfde");
              // templateDoc = await loadDoc("cb760837-1385-458d-b30a-28fff1cb5683");
              if (templateDoc) alert(`Template Loaded`);
              else alert(`Failed to process planogram file: ${targetFile.name}`);
            }
            break;
          case "prepare":
            await requireBothDocs(targetDoc, templateDoc)
            await prepare(targetDoc, templateDoc);
            alert(`Preparation Complete`)
            break;
          case "optimise":
            controller = new AbortController();
            await optimise(targetDoc, controller);
            break;
          case "blocking":
            await blocking(targetDoc);
            break;
          case "reoptimisePrepare":
            await reOptPrep(targetDoc)
            break;
          case "reoptimise":
            controller = new AbortController();
            await reoptimise(targetDoc, controller);
            break;
          case "subPlanogramPrepare":
            await requireBothDocs(targetDoc, templateDoc)
            await subPlanogramPrepare(targetDoc, templateDoc);
            alert(`SubPlangrom Preparation Complete`)
            break;
          case "tidy":
            await tidy(targetDoc);
            break;
        }
      case "optimiseAction":
        switch (receivedMessage.step) {
          case "start":
            controller = new AbortController();
            await optimise(targetDoc, controller);
            break;
          case "stop":
            controller.abort()
            break;
          case "next":
            controller = new AbortController();
            optimise(targetDoc, controller);
            controller.abort()
            break;
          case "clearCache":
            clearOptimiseCache()
            break;
        }
        break;
      case "reoptimiseAction":
        switch (receivedMessage.step) {
          case "start":
            controller = new AbortController();
            await reoptimise(targetDoc, controller);
            break;
          case "stop":
            controller.abort()
            break;
          case "next":
            controller = new AbortController();
            reoptimise(targetDoc, controller);
            controller.abort()
            break;
          case "clearCache":
            clearOptimiseCache()
            break;
        }
        break;
      case "highlight":
        switch (receivedMessage.key) {
          case "desc35":
            highlight(blockname)
            break
          case "desc36":
            highlight(largerblock)
            break
          case "desc37":
            highlight(dividerblocks)
            break
          case "desc39":
            highlight(revistedblocks)
            break
          case "new":
            highlight(assortAdd)
            break
          case "dims":
            let prodUuids = checkAltEqMinSqu(targetDoc)
            dimsCalc = (pos) => prodUuids.includes(pos.product.uuid) ? cRed : cGreen
            highlight("dims", dimsCalc)
            break
          case "dos":
            dosCalc = (pos) => {
              val = pos.planogramProduct.calculatedFields.actualDaysSupply
              if (val === 0) return cWhite;
              if (val < 3) return cRed
              if (val >= 3 && val < 7) return cOrange
              if (val >= 7) return cGreen
              return cWhite
            }
            highlight("dos", dosCalc, ["planogramProduct.calculatedFields.actualDaysSupply"])
            break
          case "packout":
            packoutCalc = (pos) => {
              val = pos.planogramProduct.calculatedFields.capacity / (Number.isNaN(pos.product.data.value.get(6)) ? 1 : (pos.product.data.value.get(6) === 0 ? 1 : pos.product.data.value.get(6)))
              if (val < 1) return cRed
              if (val >= 1 && val < 1.5) return cOrange
              if (val >= 1.5) return cGreen
              return cWhite
            }
            highlight("packout", packoutCalc, ["planogramProduct.calculatedFields.capacity", "product.data.value.6"])
            break
          case "prevfacings":
            facingsdiffCalc = (pos) => {
              facings = pos.planogramProduct.calculatedFields.facings
              prevfacings = (Number.isNaN(parseFloat(pos.product.data.performanceDesc.get(50))) ? 1 : parseFloat(pos.product.data.performanceDesc.get(50)))
              return facings === prevfacings ? cGreen : cRed
            }
            highlight("prevfacings", facingsdiffCalc, ["planogramProduct.calculatedFields.facings", "product.data.performanceDesc.50"])
            break
          case "reset":
            resetHighlights();
            break
          case "blockingfails":
            blockSizes = await blocking(targetDoc, true)
            facingsdiffCalc = (pos) => {
              let blocks = blockSizes[specialGetUtil(pos, largerblock)]
              if (!blocks) return cWhite
              let block = blocks[specialGetUtil(pos, dividerblocks)]
              if (!blocks) return cWhite
              return block.minSize <= block.maxSize ? cGreen : cRed
            }
            highlightAsync("blockingfails", facingsdiffCalc)
            break;
          case "blockingwidth":
            blockSizes = await blocking(targetDoc, true)
            facingsdiffCalc = (pos) => {
              let blocks = blockSizes[specialGetUtil(pos, largerblock)]
              if (!blocks) return cWhite
              let totalWidth = Object.values(blocks).reduce((total, z) => total + z.minSize, 0)
              return totalWidth + (Object.values(blocks).length - 1) * dividerWidthWithT <= pos.fixture.calculatedFields.combinedLinear ? cGreen : cRed
            }
            highlightAsync("blockingwidth", facingsdiffCalc)
            break;
          case "facingsmatch":
            facingsMatchCalc = (pos) => {
              let pog = targetDoc.data.planogram;
              const allEqual = arr => arr.every(v => v === arr[0])
              let data = []
              for (let [, prodinfo] of pog.productsInfo) {
                if (prodinfo.positions.length > 1) {
                  let posfacings = prodinfo.positions.map(pos => pos.facings.x);
                  let isEqual = allEqual(posfacings)
                  if (!isEqual) data.push(prodinfo.product.uuid)
                }
              }
              let colors = {}

              data.forEach((v, index) => colors[v] = selectColor(index, data.length));

              val = specialGetUtil(pos, "product.uuid")
              color = val in colors ? colors[val] : cWhite
              return color
            }
            highlight("facingsmatch", facingsMatchCalc, ["planogramProduct.calculatedFields.facings"])
            break;
        }
        break;
      case "label":
        switch (receivedMessage.key) {
          case "desc35":
            label(blockname)
            break
          case "desc36":
            label(largerblock)
            break
          case "desc37":
            label(dividerblocks)
            break
          case "desc39":
            label(revistedblocks)
            break
          case "new":
            label(assortAdd)
            break
          case "dos":
            dosCalc = (pos) => Math.round(pos.planogramProduct.calculatedFields.actualDaysSupply * 100) / 100
            label("dos", dosCalc, ["planogramProduct.calculatedFields.actualDaysSupply"])
            break
          case "packout":
            packoutcalc = (pos) => Math.round(pos.planogramProduct.calculatedFields.capacity / (Number.isNaN(pos.product.data.value.get(6)) ? 1 : (pos.product.data.value.get(6) === 0 ? 1 : pos.product.data.value.get(6))) * 100) / 100
            label("packout", packoutcalc, ["planogramProduct.calculatedFields.capacity", "product.data.value.6"])
            break
          case "prevfacings":
            facingsdiffCalc = (pos) => {
              prevfacings = (Number.isNaN(parseFloat(pos.product.data.performanceDesc.get(50))) ? 1 : parseFloat(pos.product.data.performanceDesc.get(50)))
              return prevfacings
            }
            label("prevfacings", facingsdiffCalc, ["product.data.performanceDesc.50"])
            break;
          case "reset":
            resetLabel();
            break
        }
        break
      case "condition":
        switch (receivedMessage.key) {
          case "Score":
            scorecalc = pos => Math.round(scoringFn(pos) * 100) / 100
            label("score", scorecalc)
            break;
          default:
            calc = async (pos) => {
              val = await optimise(targetDoc, null, { condition: receivedMessage.key, pos: pos })
              return val ? 0x00ff00 : 0xff0000
            }
            highlightAsync(receivedMessage.key, calc)
            break;
        }
        break
      case "condition2":
        switch (receivedMessage.key) {
          case "Score":
            scorecalc = pos => Math.round(scoringFn(pos) * 100) / 100
            label("score2", scorecalc)
            break;
          default:
            calc = async (pos) => {
              val = await reoptimise(targetDoc, null, { condition: receivedMessage.key, pos: pos })
              return val ? 0x00ff00 : 0xff0000
            }
            highlightAsync(receivedMessage.key, calc)
            break;
        }
    }
  };

  const ihtml = cssStyle + body + script;
  const ctx = open(ihtml, handleEvent);
}

//#endregion


//#region UTILS


//converts inches to meters
function in2M(value) {
  return value * .0254
}

//converts meters to inches
function meters2IN(value) {
  return value * 39.3700787
}

//loads a document within VQ based on the doc's uuid.
async function loadDoc(targetFileUuid) {
  const targetFile = await VqUtils.getFile(targetFileUuid)
  const blob = await VqUtils.getBlob(targetFile);
  const doc = await RplanUtils.process(blob, targetFile);
  await RplanUtils.sleep(1000);
  if (!doc) return null;
  return doc;
}

//here!!
function calculateAvgDOSByDesc37(pog) {
  console.log("\n===== Average DOS by Desc37 Group =====");

  // Group products by desc37, tracking unique UPCs with detailed info
  const groupedByDesc37 = {};

  for (let pos of pog.positions) {
    const desc37 = pos.product?.data?.performanceDesc?.get(37);
    if (!desc37) continue;

    const upc = pos.product.upc;

    // Calculate DOS using the correct formula: (capacity / movement) * 7
    const movement = pos.product.data.performanceValue?.get(1) || 0;
    const capacity = pos.planogramProduct?.calculatedFields?.capacity ||
      pos.capacity ||
      pos.product?.capacity || 0;
    const dos = (movement > 0 && capacity > 0) ? (capacity / movement) * 7 : 9.0;

    // Initialize group if needed
    if (!groupedByDesc37[desc37]) {
      groupedByDesc37[desc37] = {};
    }

    // Only count each UPC once per group (first occurrence wins)
    // Store detailed info for verification
    if (!groupedByDesc37[desc37][upc]) {
      groupedByDesc37[desc37][upc] = {
        dos: dos,
        movement: movement,
        capacity: capacity,
        productName: pos.product.name || 'Unknown'
      };
    }
  }

  // Calculate and display averages with detailed UPC-level logging
  const results = {};
  for (let [desc37Group, upcs] of Object.entries(groupedByDesc37)) {
    const upcList = Object.keys(upcs);
    const totalDOS = Object.values(upcs).reduce((sum, info) => sum + info.dos, 0);
    const avgDOS = upcList.length > 0 ? totalDOS / upcList.length : 0;

    results[desc37Group] = {
      avgDOS: avgDOS,
      totalUPCs: upcList.length,
      totalDOS: totalDOS
    };

    console.log(`--- ${desc37Group} ---`);
    console.log(`Average DOS: ${avgDOS.toFixed(2)} days`);
    console.log(`Total UPCs: ${upcList.length}`);

  }
  return results;
}

//newwwwwwwwwwwwwww
// Used for BEFORE/AFTER snapshots. Not necessary for production, but helpful for debugging -- can be deleted
//This function reads segment names to group alike segments together -- then logs products organized within each of these groups 
function logAllProductLocationsByGroups(targetDoc, label = "PRODUCT LOCATIONS BY GROUPS") {

  const pog = targetDoc.data.planogram;
  const allPositions = Array.from(pog.positions);

  // Step 1: Get all segments sorted left-to-right
  const segments = Array.from(pog.segments).sort((a, b) => a.uiX - b.uiX);

  if (segments.length === 0) {
    console.log("No segments found");
    return {};
  }

  // Step 2: Group consecutive segments by name
  const segmentGroups = [];
  let currentGroup = null;
  let blankCounter = 0; // Track separate blank groups

  for (let segment of segments) {
    let segmentName = segment.name.trim();

    // Handle blank segment names - each blank is its own group
    if (segmentName === "" || segmentName === null || segmentName === undefined) {
      blankCounter++;
      segmentName = `BLANK ${blankCounter}`;

      // Blank segments are always separate groups
      currentGroup = {
        name: segmentName,
        segments: [segment]
      };
      segmentGroups.push(currentGroup);
    } else {
      // Non-blank segments: group consecutive same-names together
      if (!currentGroup || currentGroup.name !== segmentName) {
        // Start a new group
        currentGroup = {
          name: segmentName,
          segments: [segment]
        };
        segmentGroups.push(currentGroup);
      } else {
        // Add to existing group (consecutive same name)
        currentGroup.segments.push(segment);
      }
    }
  }

  segmentGroups.forEach(group => {
    console.log(`   - ${group.name}: ${group.segments.length} segment(s)`);
  });

  const snapshot = {};

  // Step 3: Process each group
  segmentGroups.forEach((group, groupIndex) => {
    console.log(`GROUP: ${group.name} (${group.segments.length} segment${group.segments.length > 1 ? 's' : ''})`);

    // Get all fixtures from ALL segments in this group, organized by Y-level
    const fixturesByY = {};

    group.segments.forEach(segment => {
      segment.fixturesIn.forEach(fix => {
        const yKey = Math.round(fix.position.y * 1000) / 1000; // Round to avoid floating point issues

        if (!fixturesByY[yKey]) {
          fixturesByY[yKey] = [];
        }

        fixturesByY[yKey].push({
          fixture: fix,
          segment: segment,
          segmentX: segment.uiX
        });
      });
    });

    // Sort Y-levels from top to bottom
    const yLevels = Object.keys(fixturesByY).sort((a, b) => parseFloat(b) - parseFloat(a));

    // Step 4: For each Y-level (fixture level), get ALL products left-to-right across ALL segments
    yLevels.forEach((yLevel, fixtureIndex) => {
      const fixturesAtThisY = fixturesByY[yLevel];

      // Sort fixtures left-to-right by segment position
      fixturesAtThisY.sort((a, b) => a.segmentX - b.segmentX);

      // Collect all products from all fixtures at this Y-level
      const allProductsAtThisY = [];

      fixturesAtThisY.forEach(fixInfo => {
        // Get products on this specific fixture
        const productsOnFixture = allPositions
          .filter(pos => {
            // Product belongs to this fixture
            if (pos.fixture !== fixInfo.fixture) return false;

            // Use 80% rule to confirm it's in the correct segment
            const productLeft = pos.uiX;
            const productWidth = pos.facings.x * pos.merchSize.x;
            const productRight = productLeft + productWidth;

            const segmentLeft = fixInfo.segment.uiX;
            const segmentRight = fixInfo.segment.uiX + fixInfo.segment.width;

            const overlapLeft = Math.max(productLeft, segmentLeft);
            const overlapRight = Math.min(productRight, segmentRight);
            const overlapWidth = Math.max(0, overlapRight - overlapLeft);
            const percentageInSegment = (overlapWidth / productWidth) * 100;

            return percentageInSegment > 80;
          })
          .sort((a, b) => a.uiX - b.uiX); // Sort left-to-right

        allProductsAtThisY.push(...productsOnFixture);
      });

      // Log the combined product list for this fixture level
      const upcList = allProductsAtThisY.map(pos => pos.product.upc.slice(-6)).join(', ');
      console.log(`  Fixture ${fixtureIndex + 1}: ${upcList}`);

      // Store in snapshot for later comparison
      allProductsAtThisY.forEach((pos, orderIndex) => {
        snapshot[pos.product.upc] = {
          group: group.name,
          groupIndex: groupIndex,
          fixture: fixtureIndex + 1,
          yLevel: yLevel,
          order: orderIndex
        };
      });
    });
  });

  console.log("\n" + "=".repeat(80) + "\n");

  return snapshot;
}

//newwwwwwwwwwwwwwwwwwwww

// #region ALGO

class PlanogramConverter {
  static combinedLinear(shelf) {
    let total = shelf.width;
    let nextShelf = shelf.fixtureRight;

    /* Could probably just make this the loop condition but
     * Olly mentioned that this is going to be looked at later on.
     * Agreed to leave it as is for now. */
    if (!nextShelf) return total;

    while (true) {
      total += nextShelf.width;
      nextShelf = nextShelf.fixtureRight;
      if (!nextShelf) break;
    }
    return total;
  }

  // static getAvgUnitMovement(positions) {
  //   return 5;
  // }

  static overrideUnitMovement(pos) {
    let pD38 = pos.product.data.performanceDesc.get(38)
    let pD43 = pos.product.data.performanceDesc.get(43)
    let mvmtCheck = Number(pos.product.data.performanceValue.get(1)) > 0 ? Number(pos.product.data.performanceValue.get(1)) : .2
    let pMvmt = !pD43.includes("CEL") ? Number(mvmtCheck) : .1
    let pFacings = pos.planogramProduct.calculatedFields.facings
    let pDOS = ((pos.planogramProduct.calculatedFields.capacity / pMvmt) * 7)
    let pFacingsMultiplier = Number(pFacings > 15 ? 10 : (pFacings >= 10 ? 7 : (pFacings >= 5 ? 2 : .5)))
    let p3DOSMult = pFacings >= 10 ? 1 : (!pD38.includes("S") ? 2.25 : 1.7)
    let p5DOSMult = pFacings >= 10 ? 1 : (!pD38.includes("S") ? 1.7 : 1.35)
    let p7DOSMult = pFacings >= 10 ? 1 : (!pD38.includes("S") ? 1.35 : 1.17)
    let pMinMvmt = Math.max(.1, ((!pD38.includes("S") ? 1 : 2) - (pMvmt > 0 ? (pDOS / 500) : (.2 * pFacings))))
    if (pMvmt > 0) {
      if (pFacings >= 15) {
        return (pMvmt / 20)
      } else if (pFacings >= 10) {
        return (pMvmt / 10)
      } else {
        return pMvmt
      }
    };
  }

  static fromPlanogram(pog) {
    const shelves = pog.fixtures
      .filter(fixture => {
        let filter =
          fixture.transform.worldPos.y >= 0 &&
          fixture.transform.worldPos.y < pog.height;
        return filter;
      })
      .filter(fixture => {
        // Reasons for filter go here:
        const isShelf = fixture.ftype === 0 || fixture.ftype === 6;
        const consumerInclude = fixture.optimize;

        // Evaluation step indicates intent and useful when debugging:
        const shouldFilter = isShelf && consumerInclude;
        return shouldFilter;
      })
      .map(fixture => fixture.fixtureLeftMost)
      .reduce((fs, fix) => {
        if (!fs.includes(fix)) fs.push(fix);
        return fs;
      }, [])
      .sort((a, b) => a.transform.worldPos.y - b.transform.worldPos.y);

    const getMerchSpace = (shelves, shelf) => {
      const shelfAbove = shelves
        .filter(s => s.transform.worldPos.x === shelf.transform.worldPos.x)
        .sort((a, b) => a.transform.worldPos.y - b.transform.worldPos.y)
        .find(s => s.transform.worldPos.y > shelf.transform.worldPos.y);
      const merchSpace = shelfAbove
        ? shelfAbove.transform.worldPos.y -
        shelfAbove.height -
        shelf.transform.worldPos.y
        : (shelf.segment?.height || 72) - shelf.yVal;
      return shelf.merchSpace > 0 && shelf.merchSpace < merchSpace
        ? shelf.merchSpace
        : merchSpace;
    };

    let allpos = shelves.reduce((acc, shelf) => {
      const positions = pog.positions
        .filter(pos => pos?.fixture?.fixtureLeftMost === shelf)
        .sort((a, b) => a.rank.x - b.rank.x);

      return acc.concat(positions);
    }, []);

    // const avgUnitMovement = this.getAvgUnitMovement(allpos);

    const serializedShelves = shelves.map((shelf, index) => ({
      objectId: shelf._id,
      width: this.combinedLinear(shelf),
      worldPos: {
        x: shelf.transform.worldPos.x,
        y: shelf.transform.worldPos.y,
      },
      depth: shelf.depth,
      height: shelf.height,
      merchSpace: getMerchSpace(shelves, shelf),
      fixtureType: "Shelf",
      positions: pog.positions
        .filter(pos => pos?.fixture?.fixtureLeftMost === shelf)
        .sort((a, b) => a.rank.x - b.rank.x)
        .map(pos => {
          return {
            objectId: pos._id,
            facings: {
              x: pos.facings.x,
              y: pos.facings.y,
              z: pos.facings.z,
            },
            merchSize: {
              x: pos.merchSize.x,
              y: pos.merchSize.y,
              z: pos.merchSize.z
            },
            restrictions: {
              allowedShelves: null
            },
            data: {
              uuid: pos.product.uuid,
              product: pos.product.uuid,
              attrs: {
                Segment: pos.product.data.performanceDesc.get(37),
                Brand: pos.product.data.performanceDesc.get(45),
                Family: pos.product.uuid,
                MicroBlock: pos.product.data.performanceDesc.get(43)
              },
              block: "",
              unitMovement: this.overrideUnitMovement(pos),
              modSequence: Number(pos.product.modSequence),
              maxFacings: 1000,
              rules: {},
            },
          };
        }),
    }));

    return serializedShelves;
  }

  static applyToPlanogram(pog, serializedShelves) {
    let allpos = [];

    for (let serializedShelf of serializedShelves) {
      const { objectId, positions } = serializedShelf;
      let shelf = pog.fixtures.find(fixture => fixture._id === objectId);

      let rank = 0;
      for (let item of positions) {
        allpos.push(item.objectId);

        let pos = pog.positions.find(
          position => position._id === item.objectId,
        );
        pos.parent = shelf;
        pos.position.y = 0;
        pos.facings.x = item.facings.x;
        pos.rank.x = rank++;
      }

      shelf.layoutByRank();
    }

    // Clear positions from the planogram
    for (let shelfItem of serializedShelves) {
      let shelfObj = shelfItem.objectId;
      let shelf = pog.fixtures.find(fixture => fixture._id === shelfObj);
      let positions = pog.positions.filter(
        pos => pos.fixture?.fixtureLeftMost === shelf,
      );
      for (let pos of positions) {
        if (!allpos.includes(pos._id)) pos.parent = null;
      }
    }
  }
}

let ALGO_CONFIG = {
  maxDepth: 3,
  maxIterations: 500_000,
  swapOn: false,
  scoreWorseOn: false,
  problemPositionsOn: false,
  splitOn: false,
  scoreOnlyAtEnd: false,
  weights: [
    {
      ghostShelf: { default: 0, product: 1_000_000_000 },
      middle: { default: 0, Segment: 0, Brand: 0, MicroBlock: 0 },
      width: { default: 0, Segment: 0, Brand: 0, MicroBlock: 0, all: 1_000 },
      overlaps: { default: 0.4, Segment: 7_500_000, Brand: 750_000_000, MicroBlock: 750_000_000 },
      rowSequential: { default: 50_000_000 },
      colSequential: { default: 100_000_000 },
      singleOnShelf: {
        default: 0,
        Segment: 0,
        Brand: 0,
        Family: 0,
        MicroBlock: 0,
        product: 0,
      },
      overflow: { default: 10_000_000_000 },
      emptyShelf: { default: 500_000_000_000, all: 500_000_000_000 },
      multiShelf: { default: 0, Family: 1_000_000_000 },
      allSameShelf: { default: 0, MicroBlock: 55_000 },
      allSameShelfGT48: { default: 0 },
      blockingLT10: { default: 0, Segment: 0, Brand: 0, MicroBlock: 0 },
      allowedShelfMismatch: { default: 1_000_000_000 }
    },
  ],
};

async function shuffle(doc, config = ALGO_CONFIG) {
  pog = doc.data.planogram;

  let planogram = PlanogramConverter.fromPlanogram(pog);

  const result = await processDataWithWorker({
    planogram,
    config,
    type: "shuffle",
  });

  PlanogramConverter.applyToPlanogram(pog, result.serializedShelves);

  return result.totalScore;
}

async function expansion(doc, config = ALGO_CONFIG) {
  pog = doc.data.planogram;

  const planogram = PlanogramConverter.fromPlanogram(pog);

  const result = await processDataWithWorker({
    planogram,
    config,
    type: "expansion",
  });

  if (result.totalScore === -1) return true;

  PlanogramConverter.applyToPlanogram(pog, result.serializedShelves);

  return false;
}

async function score(doc, config = ALGO_CONFIG) {
  pog = doc.data.planogram;
  let planogram = PlanogramConverter.fromPlanogram(pog);

  const result = await processDataWithWorker({
    planogram,
    config,
    type: "score",
  });

  return result.totalScore;
}

async function shuffleAndExpand(doc) {
  const config = JSON.parse(JSON.stringify(ALGO_CONFIG));

  while (true) {
    await shuffleUntilStable(doc, config);

    for (let i = 0; i < 1; i++) {
      const finished = await expansion(doc, config);
      await sleep(10);
      if (finished) return;
    }
  }
}

async function shuffleUntilStable(
  doc,
  config = ALGO_CONFIG,
  finishFn = () => { },
) {
  let noImprovementCount = 0;
  let lowestScore = await score(doc, config);
  for (let i = 0; i < 100; i++) {
    let newScore = await shuffle(doc, config);

    if (Math.abs(lowestScore - newScore) < 0.1) noImprovementCount += 1;
    else noImprovementCount = 0;

    if (noImprovementCount > 0 || finishFn()) break;
    lowestScore = newScore;
    await sleep(10);
  }
}

async function processDataWithWorker(data) {
  let url =
    "https://storage.googleapis.com/core-345-assets/file_blobs/39/39ce8e655f3e23a93a8f445939325d69.so";
  try {
    if (RUST_URL) url = RUST_URL;
  } catch (e) { }

  if (data.type === "score") {
    const score = await ExternalLibUtils.run({
      url: url,
      libraryName: "poggen",
      funcName: "score",
      retType: "Double",
      paramsType: ["String", "String"],
      paramsValue: [
        JSON.stringify(data.config),
        JSON.stringify(data.planogram),
      ],
    });
    return { totalScore: score };
  } else if (data.type === "shuffle") {
    const resultStr = await ExternalLibUtils.run({
      url: url,
      libraryName: "poggen",
      funcName: "shuffle",
      retType: "String",
      paramsType: ["String", "String"],
      paramsValue: [
        JSON.stringify(data.config),
        JSON.stringify(data.planogram),
      ],
    });
    const result = JSON.parse(resultStr);
    return {
      totalScore: result.totalScore,
      serializedShelves: result.planogram,
    };
  } else if (data.type === "expansion") {
    const resultStr = await ExternalLibUtils.run({
      url: url,
      libraryName: "poggen",
      funcName: "expansion",
      retType: "String",
      paramsType: ["String", "String"],
      paramsValue: [
        JSON.stringify(data.config),
        JSON.stringify(data.planogram),
      ],
    });
    const result = JSON.parse(resultStr);
    return {
      totalScore: result.totalScore,
      serializedShelves: result.planogram,
    };
  }
}
// #endregion

async function shuffleOnAllBlocks(doc) {
  const pog = doc.data.planogram

  // for (let pos of doc.data.planogram.positions) pos.facings.x = 2;
  let posits = pog.positions
  let desc39dict = {}

  for (let pos of posits) {
    let d39 = pos.product.data.performanceDesc.get(45)
    if (!Object.keys(desc39dict).includes(d39)) desc39dict[d39] = []
    desc39dict[d39].push(pos)
  }

  for (let key of Object.keys(desc39dict)) {
    blockInfo = desc39dict[key].reduce((total, a) => {
      let fix = a.fixture.fixtureLeftMost.uuid
      if (!total[fix]) total[fix] = total[fix] = 0
      total[fix] += a.merchSize.x * a.facings.x
      return total
    }, {})

    blockMinRankXbyShelf = desc39dict[key].reduce((total, a) => {
      let fix = a.fixture.fixtureLeftMost.uuid
      if (!total[fix]) total[fix] = total[fix] = Infinity
      total[fix] = total[fix] < a.rank.x ? total[fix] : a.rank.x
      return total
    }, {})

    blockYlocations = desc39dict[key].reduce((total, a) => {
      let fix = a.fixture.fixtureLeftMost.uuid
      let yFix = a.fixture.transform.worldPos.y
      if (!total[yFix]) total[yFix] = fix
      return total
    }, {})

    blockMaxWidth = Object.values(blockInfo).reduce((total, b) => total > b ? total : b, 0)

    blockShelfCount = Object.keys(blockInfo).length

    let temporaryFixs = []


    for (let fKey of Object.keys(blockInfo)) {
      const tFix = pog.fixtures.find(f => f.uuid === fKey);
      let fix = doc.createByDef(
        {
          ...tFix.valuesByTracker("@copy"),
          width: blockInfo[tFix.fixtureLeftMost.uuid],
          canCombine: 0,
          position: { x: 10, y: tFix.transform.worldPos.y }
        },
        pog,
      );
      temporaryFixs.push(fix)
      for (let pos of desc39dict[key].filter(z => z.fixture.fixtureLeftMost.uuid === fKey)) {
        // pos.merch.y.number.value = 1; // set y facings to manual
        pos.parent = fix
        pos.position.y = fix.transform.worldPos.y
      }
      await sleep(5)
      fix.layoutByRank()

    }

    for (let fix of temporaryFixs) {
      fix.optimize = true;

      let fixPosits = pog.positions.filter(f => f.parent === fix)
      for (let pos of fixPosits) {
        pos.facings.x = pos.product.data.performanceDesc.get(38).includes("S") ? 2 : 1;
      }
    }

    await shuffleAndExpand(doc);

    for (let f of temporaryFixs) {
      realUUID = blockYlocations[f.transform.worldPos.y]
      minRankX = blockMinRankXbyShelf[realUUID] - 1
      counter = .01
      blockPosits = pog.positions.filter(z => z.fixture.uuid === f.uuid).sort((a, b) => a.rank.x - b.rank.x)
      realFix = pog.fixtures.find(z => z.uuid === blockYlocations[f.transform.worldPos.y])
      for (let pos of blockPosits) {
        pos.parent = realFix
        pos.rank.x = minRankX + counter
        counter += .01
      }
      realFix.layoutByRank()
      f.parent = null
    }

  }
}


// async function run(args) {
//   const file = await VqUtils.getFile(args.targetUuid);
//   const blob = await VqUtils.getBlob(file);
//   const doc = await RplanUtils.process(blob, file);

//   await shuffleOnAllBlocks(doc);

//   let outputBlob = await RplanUtils.export(doc, "psa");

//   await VqUtils.createFile(
//     file.name.replace(".psa", " - Processed kh shelves allowed test4.psa"),
//     file.folderUuid,
//     outputBlob,
//     true,
//   );
// }


//Checks if POG is a Project POG and doesn't save if it is
async function savePOGExcludeProjectPOGs(file, targetDoc, projectTextBoxCounter, outputFolder) {
  console.log("Saving...")
  let outputBlob = await RplanUtils.export(targetDoc, "psa");
  if (Number(projectTextBoxCounter) === 0) {
    if (targetDoc.data.planogram.data.desc.get(50) === "OVER-ALLOCATED") {
      await VqUtils.createFile(file.name.replace(".psa", " - OVERALLOCATED") + ".psa", outputFolder.uuid, outputBlob, true)
    } else {

      targetDoc.data.planogram.data.desc.set(50, "PROCESSED")

      await VqUtils.createFile(file.name, outputFolder.uuid, outputBlob, true)
    }
    console.log("Finished")
  }
}

//extracts data from a file based on the file's uuid. file is assumed to be a csv or xlsx file.
async function getDataFromFile(fileUuid, sheetNum = 0) {
  let fileRef = await VqUtils.getFile(fileUuid);
  let fileBlob = await VqUtils.getBlob(fileRef);
  let f = await fileBlob.arrayBuffer();
  const wb = XLSX.read(f);
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[sheetNum]], {
    raw: false,
  });
  return data;
}

// searches for the files within a folder based the parent folder's uuid and a name.
//If no such folder exists. A new folder is created with said name within the parent folder.
async function getOrCreateFolder(parentFolderUuid, name) {
  let folder = (await VqUtils.getFilesInFolder(parentFolderUuid)).find(f => f.name === name);
  if (!folder) {
    folder = await VqUtils.createFolder(parentFolderUuid, name);
  }
  return folder;
}


// function to check if pos shouldn't be touched by various parts of the script. Main example is the DIP Shelf in C055.
function leavePosAlone(pos) {
  if (pos.fixture.segment.fixturesIn.size > 5) {
    sorted_fixs = pos.fixture.segment.fixturesIn.filter(f => f.name !== "Bagged Snacks Divider" && f.depth > .1).sort((a, b) => a.position.y - b.position.y)
    if (sorted_fixs.at(4) === pos.fixture)
      return true
  }
}

//only used in UI script option
async function getData(doc) {
  let pog = doc.data.planogram;

  let prodUsed = 0
  let prodUnused = 0;
  for (let [, prod] of pog.productsInfo) {
    if (prod.usedStatus === "Used") prodUsed++
    else prodUnused++
  }

  data = {
    filename: doc.filename,
    name: pog.name,
    store: pog.data.desc.get(1),
    productCount: prodUsed + prodUnused,
    productsUsed: prodUsed,
    productsUnused: prodUnused
  }

  return data
}

// rounds a value to a specified number of decimal places
function round2dp(v, dp = 2) {
  return Math.round(v * 10 ** dp) / 10 ** dp
}

//only used in UI
function checkAltEqMinSqu(targetDoc) {
  let failedUuids = new Set()
  for (let [uuid, prod] of targetDoc.data.products) {
    if (round2dp(prod.alternateWidth) !== round2dp(prod.width * prod.minimumSqueezeFactorX))
      failedUuids.add(uuid)
    if (round2dp(prod.alternateHeight) !== round2dp(prod.height * prod.minimumSqueezeFactorY))
      failedUuids.add(uuid)
    if (round2dp(prod.alternateDepth) !== round2dp(prod.depth * prod.minimumSqueezeFactorZ))
      failedUuids.add(uuid)
  }
  return Array.from(failedUuids)

}

//only used in UI. Requires a template has been loaded prior to processing.
async function requireBothDocs(targetDoc, templateDoc) {
  if (!targetDoc || !templateDoc || targetDoc === templateDoc) {
    alert(
      "You need to have 2 planograms. A template with positions and a selected target with positions."
    );
    throw "error";
  }
}


// Determines which set of templates should be used for a Target based on the Target's Division and SSPN.
// Template assignment logic often changes between commodities. This function and its arguments are often changed.
async function getTemplateSizesList(targDivision, sspn) {
  let version = sspn.substring(22, 25)
  let tempGroup1 = "014"
  // let tempGroup2 = "034, 035"
  // let tempGroup3 = "531, 534"
  let versionGroup1 = "555, 560"
  // let versionGroup2 = "230, 232, 236, 239"
  // let versionGroup3 = "943, 944"
  // let versionGroup701_5shelf = "100, 105"
  // let versionGroup701_6_shelf = "108"
  // let versionGroup703_UNFI = "U01, U03, U04"
  if (tempGroup1.includes(targDivision) && versionGroup1.includes(version)) {
    return templates_014_v555_v560_Group
    // } else if (tempGroup1.includes(targDivision) && versionGroup2.includes(version)) {
    //   return templates_011_014_016_018_021_024_025_026_029_615_660_706_v232_Group
    // } else if (tempGroup1.includes(targDivision) && versionGroup3.includes(version) && targDivision != '620') {
    //   return templates_531_534_Group
  }
}


// uses the size of the target to pick the appropriate template from the TempGroup
async function getTemplateUUID2(targtotSize, tempGroup) {
  tempsize = tempGroup.filter(z => in2M(z.size * 12) <= targtotSize).reduce((total, a) => a.size >= total ? a.size : total, 0)
  console.log(tempsize)
  if (tempsize === 0) {
    return
  }
  return tempGroup.find(t => t.size === tempsize).uuid

}

function facingsMatch(doc) {
  let pog = doc.data.planogram;

  const allEqual = arr => arr.every(v => v === arr[0])

  let data = []
  for (let [, prodinfo] of pog.productsInfo) {
    if (prodinfo.positions.length > 1) {
      let posfacings = prodinfo.positions.map(pos => pos.facings.x);
      let isEqual = allEqual(posfacings)
      if (!isEqual) data.push(prodinfo.product.uuid)
    }
  }

  let colors = {}
  data.forEach((v, index) => colors[v] = selectColor(index, data.length));

  app.sys.view.project.planogram.positions.forEach(pos => {
    val = specialGetUtil(pos.data, "product.uuid")
    color = val in colors ? colors[val] : 0xffffff
    pos.setHighlightColor(color);
  });
}


activeLabelKey = null

function resetLabel() {
  let view = app.sys.view;
  view.settings.positionLabelOn = false;
  view.settings.positionLabelMethod = null;
  activeLabelKey = null;
}

function label(key, func, tracks) {
  if (activeLabelKey === key) {
    resetLabel()
    return
  }
  activeLabelKey = key

  let view = app.sys.view;

  view.settings.positionLabelOn = true;
  view.settings.positionLabelMethod = {
    tracks: func ? (tracks ? getTrackingState(tracks) : null) : getTrackingState([key]),
    label: node => {
      let val = func ? func(node.data) : specialGetUtil(node.data, key);
      if (val === false) return;
      return {
        text: val,
        textColor: -16777216,
        bgColor: 4292730333,
        placement: "middle",
        alignment: "center",
        orientation: "horizontal",
      };
    },
  };
}

activeHighlightKey = null

function resetHighlights() {
  let view = app.sys.view;
  view.settings.positionHighlightMethod = null;
  view.project.planogram.positions.forEach(pos => {
    pos.setHighlightColor(null);
  });
  activeHighlightKey = null
}

async function highlightAsync(key, func) {
  if (activeHighlightKey === key) {
    resetHighlights()
    return
  }

  activeHighlightKey = key

  app.sys.view.project.planogram.positions.forEach(async pos => {
    pos.setHighlightColor(await func(pos.data));
  });
}

function highlight(key, func, tracks) {
  if (activeHighlightKey === key) {
    resetHighlights()
    return
  }

  activeHighlightKey = key

  let view = app.sys.view;
  let pog = view.doc.data.planogram;
  let data = new Set();
  for (let position of pog.positions) {
    data.add(specialGetUtil(position, key))
  }
  let colors = data2Colors(Array.from(data), key);
  view.settings.positionHighlightMethod = {
    tracks: func ? (tracks ? getTrackingState(tracks) : null) : getTrackingState([key]),
    color: pos => {
      return func ? func(pos.data) : colors[specialGetUtil(pos.data, key)] ?? cWhite;
    },
  };
}

function data2Colors(data, key) {
  let colors = {}
  data.forEach((v, index) => colors[v] = selectColor(index, data.length));
  return colors
}

function selectColor(colorNum, colors) {
  if (colors < 1) colors = 1; // defaults to one color - avoid divide by zero
  // return hslToHex((colorNum * (270 / colors) % 360), 75, 50);
  return hslToHex(colorNum * 137.508, 75, 50);
}

function hslToHex(h, s, l) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');   // convert to Hex and prefix "0" if needed
  };
  return parseInt(`${f(0)}${f(8)}${f(4)}`, 16);
}

getTrackingState = (keys) => {
  tracks = {}
  for (let key of keys) {
    _.setWith(tracks, key.replace(":", "."), null, () => { return {} })
  }
  return { data: tracks };
}

// Replaces the need for .get's that reference a variable within filters, finds, etc... Desc variables are defined at the top of the script and have their number separated by : from the call location
specialGetUtil = (a, key) => {
  let [keyA, keyB] = key.split(":");
  r = keyB ? _.get(a, keyA).get(keyB) : _.get(a, key)
  return r
}


//#endregion


//#region PREPARE

async function prepare(targetDoc, templateDoc) {
  // from templateDoc
  // 1. read position location
  // 2. read segment names to match to targets
  // 3. Associate any positions in templateDoc with perfflag6 checked to targetDoc
  // 4. copy over pos.product.data.performanceDesc.get(35) & pos.product.data.performanceDesc.get(36) from templateDoc to targetDoc
  // 5. Preserve positions in targetDoc that also have positions in templateDoc plus add positions from templateDoc that have perfflag6 where their pos.product.data.performanceDesc.get(37) exists already within targetDoc

  templateProj = templateDoc.data;
  templatePOG = templateProj.planogram
  proj = targetDoc.data
  pog = proj.planogram
  posits = pog.positions
  fixs = pog.fixtures

  //NEWWWWWWW
  // Logs segment counts for template and target and returns a summary object
  function logSegmentCounts(templatePOG, targetPOG) {
    const getCount = (segs) => {
      if (!segs) return 0;
      if (typeof segs.size === 'number') return segs.size;
      if (typeof segs.length === 'number') return segs.length;
      try { return Array.from(segs).length; } catch (e) { return 0; }
    };

    const templateCount = getCount(templatePOG?.segments);
    const targetCount = getCount(targetPOG?.segments);
    const difference = targetCount - templateCount;

    console.log("Segment Counts:");
    console.log(`Template segment count: ${templateCount}`);
    console.log(`Target segment count: ${targetCount}`);
    console.log(`Segment difference = ${difference}`);
    console.log('-------------------------------------')

    return { templateCount, targetCount, difference };
  }

  // Log segment counts early for visibility
  logSegmentCounts(templatePOG, pog);


  //Name target segments based on TEMPLATE segments' names/desc37 (before orphaning)
  function nameTargetSegmentsFromCurrentProducts() {
    console.log("Naming target segments based on template desc 37 values...");

    const getCount = (segs) => {
      if (!segs) return 0;
      if (typeof segs.length === 'number') return segs.length;
      if (typeof segs.size === 'number') return segs.size;
      try { return Array.from(segs).length; } catch (e) { return 0; }
    };

    const templateSegments = Array.from(templatePOG.segments).sort((a, b) => a.uiX - b.uiX);
    const targetSegments = Array.from(pog.segments).sort((a, b) => a.uiX - b.uiX);

    const count = Math.min(templateSegments.length, targetSegments.length);
    for (let i = 0; i < count; i++) {
      const tSeg = templateSegments[i];
      const targetSeg = targetSegments[i];

      // Prefer template segment name; fallback to most common desc37 from positions in that template segment
      let templateName = tSeg?.name;
      if (!templateName || templateName === "") {
        const templatePositionsInSeg = Array.from(templatePOG.positions).filter(pos => pos.parent && pos.segment === tSeg);
        if (templatePositionsInSeg.length > 0) {
          const desc37Counts = templatePositionsInSeg.reduce((acc, pos) => {
            const val = pos.product?.data?.performanceDesc?.get(37);
            if (val !== undefined && val !== null) acc[val] = (acc[val] || 0) + 1;
            return acc;
          }, {});
          const keys = Object.keys(desc37Counts);
          if (keys.length > 0) {
            templateName = keys.reduce((a, b) => desc37Counts[a] > desc37Counts[b] ? a : b);
          }
        }
      }

      if (!templateName || templateName === "") templateName = "UNNAMED";
      targetSeg.name = templateName;
      console.log(`Segment ${i + 1}: copied name "${templateName}" from template`);
    }

    if (targetSegments.length > templateSegments.length) {
      console.log(`Skipping ${targetSegments.length - templateSegments.length} extra target segment(s) beyond template.`);
    }

    console.log("Segment naming complete.\n");
    console.log('-------------------------------------')

  }

  nameTargetSegmentsFromCurrentProducts();
  await sleep(100);


  // // Log product locations BEFORE any changes
  // const beforeSnapshot = logAllProductLocationsByGroups(targetDoc, "BEFORE ORPHANING - Initial Product Locations");
  // targetDoc._beforeSnapshot = beforeSnapshot;
  // await sleep(500);

  specialGet = (a, key) => {
    let [keyA, keyB] = key.split(":");
    r = keyB ? _.get(a, keyA).get(keyB) : _.get(a, key)
    return r
  }

  // Copy target names to template so they match
  function syncTemplateSegmentNames() {
    const tempSegments = Array.from(templatePOG.segments).sort((a, b) => a.uiX - b.uiX);
    const targSegments = Array.from(pog.segments).sort((a, b) => a.uiX - b.uiX);

    for (let i = 0; i < Math.min(tempSegments.length, targSegments.length); i++) {
      tempSegments[i].name = targSegments[i].name;
    }
  }

  syncTemplateSegmentNames();
  await sleep(100);
  //endnewwwwwwwwwwwwwwwwwww








  let kcmsDataFull = await getDataFromFile("98c30609-842c-4101-81fd-8e553cd06918");
  await sleep(25)

  //console.log(kcmsDataFull)
  kcmsData = kcmsDataFull.filter(z => z["Store Number"] === specialGet(pog, pog_store_number))
  await sleep(25)

  // set multipack segment name (hack this in for now)
  // function setMultiPackSegmentName() {
  //   for (let seg of pog.segments) {
  //     if (seg.fixturesIn.size === 5) seg.name = "MULTIPACK FULL"
  //   }
  // }

  // setMultiPackSegmentName()

  // Clear extra performance/data records from Target
  function removeUnused() {
    for (let [, prodinfo] of pog.productsInfo) {
      if (prodinfo.usedStatus === "Unused") {
        targetDoc.data.removeProduct(prodinfo.product);//abc
      }
    }
  }

  removeUnused()
  await sleep(0)


  // Copy product data from the template to the target
  function copyProductData() {
    //Copy over desc35, desc36, desc37, flag6
    for (let [, product] of proj.products) {
      const tempProduct = templateProj.products.find((p) => p.upc === product.upc);
      if (tempProduct) {
        // performance fields
        product.data.performanceDesc.set(35, tempProduct.data.performanceDesc.get(35));
        product.data.performanceDesc.set(36, tempProduct.data.performanceDesc.get(36));
        product.data.performanceDesc.set(37, tempProduct.data.performanceDesc.get(37));
        product.data.performanceDesc.set(38, tempProduct.data.performanceDesc.get(38));
        product.data.performanceDesc.set(39, tempProduct.data.performanceDesc.get(39));
        product.data.performanceDesc.set(42, tempProduct.data.performanceDesc.get(42));
        product.data.performanceDesc.set(43, tempProduct.data.performanceDesc.get(43));
        product.data.performanceDesc.set(45, tempProduct.data.performanceDesc.get(45));
        product.data.performanceDesc.set(46, tempProduct.data.performanceDesc.get(46));
        product.data.performanceDesc.set(47, tempProduct.data.performanceDesc.get(47));
        product.data.performanceFlag.set(6, tempProduct.data.performanceFlag.get(6));

        // size fields
        product.height = tempProduct.height
        product.width = tempProduct.width
        product.depth = tempProduct.depth
        // product.alternateHeight = tempProduct.alternateHeight
        // product.alternateWidth = (tempProduct.width - in2M(.04))
        // product.alternateDepth = tempProduct.depth
      } else {
        // console.log(`Could not find product: ${product.upc}`)
      }
    }
  }

  copyProductData()
  await sleep(0)


  // Old Find new Items from Template where their Desc37 is on the Target POG
  //function getNewItemsFromTemp() {
  //desc37sInTarget = posits.reduce((total, z) => {
  //desc37group = specialGet(z, dividerblocks)
  //if (!total?.[desc37group])
  //total.push(desc37group)
  //return total
  //}, [])
  //newItems = templatePOG.positions.filter(z => z.product.data.performanceFlag.get(6) && desc37sInTarget.includes(specialGet(z, dividerblocks))).reduce((total, z) => {
  //if (!total?.[z.product])
  //total.push(z.product)
  //return total
  //}, [])
  //
  //for (let prod of newItems) {
  //const targetProduct = proj.products.find((p) => p.upc === prod.upc);
  //if (targetProduct) targetProduct.upc = targetProduct.upc + ' (old)'
  // adds new items
  //const newProdData = prod.valuesByTracker("@copy");
  //const newProduct = targetDoc.data.importProduct({
  //...newProdData,
  //});
  //}
  //}
  function getNewItemsFromTemp() {
    //desc37sInTarget = pog.data.desc.get(40) 
    // Removed new item rule
    newItems = templatePOG.positions.reduce((total, z) => {
      if (!total?.[z.product])
        total.push(z.product)
      return total
    }, [])
    for (let prod of newItems) {
      const targetProduct = proj.products.find((p) => p.upc === prod.upc);
      //if (targetProduct) targetProduct.upc = targetProduct.upc + ' (old)'
      // adds new items
      const newProdData = prod.valuesByTracker("@copy");
      const newProduct = targetDoc.data.importProduct({
        ...newProdData,
      });
    }
  }

  getNewItemsFromTemp()
  await sleep(0)





  // make sure all product data has come across
  copyProductData()
  await sleep(0)

  function isReversedCheck(list1, list2) {
    let ascCount = 0;
    let descCount = 0;

    const list = list1
      .map((c) => list2.indexOf(c))
      .filter((c) => c > 0);

    for (let i = 0; i < list.length - 1; i++) {
      if (list[i] < list[i + 1]) ascCount++;
      else if (list[i] > list[i + 1]) descCount++;
    }

    if (ascCount < descCount) return true;
    else return false;
  }

  // calculate the direction of flow of the target compared to the template - FALL BACK OPTION
  // REVERSE_FLOW = false;
  // function calculateReverseFlow() {
  //   let lowestShelf = pog.fixtures.sort((a, b) => a.position.y - b.position.y).at(0)
  //   let bottomShelfUPCs = pog.positions.filter(pos => pos.fixture.position.y === lowestShelf.position.y).sort((a, b) => a.transform.worldPos.x - b.transform.worldPos.x).map(pos => pos.product.upc)
  //   let lowestShelfTemp = templatePOG.fixtures.sort((a, b) => a.position.y - b.position.y).at(0)
  //   let bottomShelfUPCsTemp = templatePOG.positions.filter(pos => pos.fixture.position.y === lowestShelfTemp.position.y).sort((a, b) => a.transform.worldPos.x - b.transform.worldPos.x).map(pos => pos.product.upc)
  //   REVERSE_FLOW = isReversedCheck(bottomShelfUPCs, bottomShelfUPCsTemp)
  // }

  // calculateReverseFlow()
  // await sleep(0)


  REVERSE_FLOW = pog.data.trafficFlow === 2

  // remove the dividers
  function dividerRemoval() {
    dividers = pog.fixtures.filter(f => f.width <= in2M(2))
    for (let div of dividers) {
      div.parent = null

    }
  }

  dividerRemoval()
  await sleep(0)


  function makePolesNonObstructive() {
    fixturesOfNote = pog.fixtures
    for (let fix of fixturesOfNote) {
      if (fix.name.includes("POLE")) {
        fix.depth = 0
        fix.canObstruct = false
      }
    }
  }

  makePolesNonObstructive()
  await sleep(25)




  function removeTargetPos() {
    for (let pos of posits) {
      pos.parent = null
    }
  }

  removeTargetPos()
  await sleep(0)

  // function setCanCombineLeftMostSegName() {
  //   const leftMostXFixbySegName = fixs.filter(z => Object.values(fixs.reduce((total, z) => {
  //     const segName = _.get(z, 'segment.name');
  //     const valueX = _.get(z, 'uiX');

  //     if (!(segName in total) || valueX < total[segName]) {
  //       total[segName] = valueX;
  //     }

  //     return total;
  //   }, {})).includes(z.uiX));

  //   for (let fix of leftMostXFixbySegName) {
  //     fix.canCombine = 1
  //   }
  // }

  // setCanCombineLeftMostSegName()
  // await sleep(0)

  //newwwwwwwwwwwwww
  function setCanCombineBySegmentGroups() {
    const segments = Array.from(pog.segments).sort((a, b) => a.uiX - b.uiX);

    const segmentGroups = [];
    let currentGroup = null;

    for (let segment of segments) {
      if (!currentGroup || currentGroup.name !== segment.name) {
        currentGroup = {
          name: segment.name,
          segments: [segment]
        };
        segmentGroups.push(currentGroup);
      } else {
        currentGroup.segments.push(segment);
      }
    }

    console.log(`Setting canCombine properties for ${segmentGroups.length} segment groups:`);
    segmentGroups.forEach(group => {
      console.log(`  - ${group.name}: ${group.segments.length} segment(s)`);
    });

    for (let group of segmentGroups) {
      const groupSegments = group.segments;
      const groupSize = groupSegments.length;

      groupSegments.forEach((segment, index) => {
        let canCombineValue;

        if (groupSize === 1) {
          canCombineValue = 3;
        } else if (index === 0) {
          canCombineValue = 3;
        } else if (index === groupSize - 1) {
          canCombineValue = 2;
        } else {
          canCombineValue = 1;
        }

        for (let fix of segment.fixturesIn) {
          fix.canCombine = canCombineValue;
        }

        console.log(`  ${segment.name} [${index + 1}/${groupSize}]  -->  canCombine = ${canCombineValue}`);
      });
    }
  }

  setCanCombineBySegmentGroups();
  await sleep(0);
  //newwwwwwwwwwwwwwwww

  // place the positions based on the Temp
  function copyPosition(position, doc, fixture) {
    const newPosData = position.valuesByTracker("@copy");

    return doc.createByDef(
      {
        type: "Position",
        isRaw: true,
        ...newPosData,
        merchStyle: 0
        //product: newProduct,
      },
      fixture
    );
  }

  function productsToArray(xs) {
    let rv = []
    for (let [, x] of xs) {
      rv.push(x)
    }
    return rv
  };

  prodsOnTarg = productsToArray(proj.products).map(p => p.id + '_' + p.upc)
  prodsOnTargUPConly = productsToArray(proj.products).map(p => p.upc)


  // move products from the template to the target
  async function placeProducts() {

    // Gets ALL segments from template pog and sorts left to right
    tempSegmentList = templatePOG.segments.sort((a, b) => a.uiX - b.uiX).reduce((total, z) => {
      if (!total?.[z.name])
        total[z.name] = []
      total[z.name].push(z)
      return total
    }, {});

    // Same as above but for TARGET - NOW segments have updated names!
    targSegmentList = pog.segments.sort((a, b) => a.uiX - b.uiX).reduce((total, z) => {
      if (!total?.[z.name])
        total[z.name] = []
      total[z.name].push(z)
      return total
    }, {});

    // names the segment in the target based on the temp?? Loop through each occurrence
    for (let [segName, segments] of Object.entries(tempSegmentList)) {

      // Get matching target segments with same name
      let targetSegments = targSegmentList[segName]
      if (!targetSegments) {
        console.warn(`  NO MATCH FOUND for "${segName}" in target segments!`);
        continue
      }

      // NEWWW: Loop through each template segment and match to corresponding target segment
      for (let i = 0; i < segments.length; i++) {
        let segment = segments[i]
        let targetSegment = targetSegments[i]
        if (!targetSegment) continue

        // Get all fixtures in that segment and sorts from BOTTOM to TOP 
        targetSegmentFixs = targetSegment.fixturesIn.sort((a, b) => a.position.y - b.position.y)
        fixs = segment.fixturesIn.sort((a, b) => a.position.y - b.position.y)

        // Place products on fixtures
        for (let [index, fix] of fixs.entries()) {
          fix1 = fix.fixtureLeftMost

          tempPos = templatePOG.positions
            .filter(z => z.segment.name === segName && z.fixture.fixtureLeftMost === fix1)
            .filter(z => (prodsOnTarg.includes(z.id + '_' + z.upc) ? true : prodsOnTargUPConly.includes(z.upc) ? true : false))
            .sort((a, b) => a.rank.x - b.rank.x)

          targFix = targetSegmentFixs.at(index)

          // NEWWW: Calculate the rank offset based on existing products on this fixture - Ensures rank.x works properly across multiple fixtures
          const existingPositionsOnFixture = pog.positions.filter(p =>
            p.parent && p.parent.fixtureLeftMost.uuid === targFix.fixtureLeftMost.uuid
          );
          const rankOffset = existingPositionsOnFixture.length > 0
            ? Math.max(...existingPositionsOnFixture.map(p => p.rank.x))
            : 0;

          // Copies each product from the template and assigns it in the target fixture 
          for (let [posindex, pos] of tempPos.entries()) {
            let newpos = copyPosition(pos, targetDoc, targFix)

            newpos.rank.x = REVERSE_FLOW
              ? rankOffset + (tempPos.length - posindex)
              : rankOffset + posindex + 1;
          }

          targFix.layoutByRank();
        }
      }
    }
  }

  await sleep(10000)
  placeProducts()
  await sleep(10000)

  //NEWWWWWWW
  // Log product locations AFTER orphaning and placement (BEFORE merch settings/dimensions change)
  const afterSnapshot = logAllProductLocationsByGroups(targetDoc, "AFTER ORPHANING - Product Locations After Placement");
  targetDoc._afterSnapshot = afterSnapshot;
  await sleep(500);
  //endNEWWWWWWWW

  pog.updateNodes()

  // set an assumed movement value 
  // assumeMvmt = 2.5
  // function assumedMovement() {
  //   for (let pos of posits.filter(z => z.product.data.unitMovement === 0)) {
  //     pos.product.data.unitMovement = assumeMvmt
  //   }
  // }

  // assumedMovement()
  // await sleep(0)

  async function waitForParent(pog) {
    while (true) {
      let allparent = pog.positions.every(v => v.parent)
      if (allparent) break;
      await sleep(50);
    }
  }

  async function waitForCalcFields(pog) {
    while (true) {
      let allcalcfields = pog.positions.every(v => v?.planogramProduct?.positionsCount > 0)
      if (allcalcfields) break;
      await sleep(50);
    }
  }

  await waitForParent(pog)
  await waitForCalcFields(pog)

  // Calculate average DOS by desc37 groups
  const avgDOSResults = calculateAvgDOSByDesc37(pog);


  // get posits (positions that we want to optimise)
  posits = pog.positions//.filter(z => !leavePosAlone(z))

  // reset position facings to 1 and set the other merch values
  // function positionReset() {
  //   for (let pos of posits) {
  //     pos.merch.x.placement.value = 3
  //     pos.merch.x.size.value = 1
  //     pos.facings.x = 1
  //   }
  // }

  // positionReset()
  // await sleep(0)

  // reset position facings to 1 and set the other merch values


  /// NEED TO WORK IN CASE INSENSITIVITY TO EXTRA FOR INITIAL INCLUDE
  function positionReset() {
    for (let pos of posits) {
      pos.merchStyle = 0
      pos.merch.x.placement.value = 3
      pos.merch.x.size.value = 1
      // if (pos.product.data.performanceDesc.get(37) === "MULTI" || pos.product.data.performanceDesc.get(37) === "MULTIPACK" || pos.product.data.performanceDesc.get(37) === " MULTIPACK") continue
      // if (pos.product.data.performanceDesc.get(38) == "SINGLES") {
      //   pos.facings.x = 2;
      // } else {
      //   pos.facings.x = 1;
      // }
      // if (pos.product.data.performanceDesc.get(38) === "PACKOUT" && Number(pog.data.desc.get(32)) >= 60) {
      //   pos.facings.x = 2
      // }
    }
  }

  positionReset()
  await sleep(1000)

  pog.updateNodes()

  //#region 
  //FIGURE OUT WHAT HAPPENED HERE

  function combineDesc37sFromPogDesc40() {
    for (let group of desc37Groupings) {
      let positsInGroup = posits.filter(z => group.includes(z.product.data.performanceDesc.get(37)))
      for (let pos of positsInGroup) {
        pos.product.data.performanceDesc.set(37, group)
      }
    }
  }



  //#endregion
  function positionDataUpdate0() {
    for (let pos of pog.positions) {
      let positionDATAset = kcmsData.filter(z => z["Base BAS_CON_UPC_NO"] === pos.product.upc)
      let positionDATA = positionDATAset[0]
      if (positionDATAset.length > 0) {
        //console.log(Number(positionDATA["Avg Weekly Margin"]))
        pos.product.data.performanceValue.set(1, (positionDATA["Avg Weekly Mvmt"] !== null && positionDATA["Avg Weekly Mvmt"] !== undefined ? Number((positionDATA["Avg Weekly Mvmt"].includes(",") ? positionDATA["Avg Weekly Mvmt"].replaceAll(",", "") : positionDATA["Avg Weekly Mvmt"])) : 0))            //Avg Weekly Mvmt
        pos.product.data.performanceValue.set(2, (positionDATA["Avg Weekly Sales"] !== null && positionDATA["Avg Weekly Sales"] !== undefined ? Number((positionDATA["Avg Weekly Sales"].includes(",") ? positionDATA["Avg Weekly Sales"].replaceAll(",", "") : positionDATA["Avg Weekly Sales"])) : 0))           //Avg Weekly Sales
        pos.product.data.performanceValue.set(3, (positionDATA["Avg Weekly Margin"] !== null && positionDATA["Avg Weekly Margin"] !== undefined ? Number((positionDATA["Avg Weekly Margin"].includes(",") ? positionDATA["Avg Weekly Margin"].replaceAll(",", "") : positionDATA["Avg Weekly Margin"])) : 0))          //Avg Weekly Margin
        pos.product.data.performanceValue.set(4, (positionDATA["26wk Avg Weekly Mvmt"] !== null && positionDATA["26wk Avg Weekly Mvmt"] !== undefined ? Number((positionDATA["26wk Avg Weekly Mvmt"].includes(",") ? positionDATA["26wk Avg Weekly Mvmt"].replaceAll(",", "") : positionDATA["26wk Avg Weekly Mvmt"])) : 0))       //Avg Weekly Mvmt 26wk
        pos.product.data.performanceValue.set(5, (positionDATA["26wk Avg Weekly Sales"] !== null && positionDATA["26wk Avg Weekly Sales"] !== undefined ? Number((positionDATA["26wk Avg Weekly Sales"].includes(",") ? positionDATA["26wk Avg Weekly Sales"].replaceAll(",", "") : positionDATA["26wk Avg Weekly Sales"])) : 0))      //Avg Weekly Sales 26wk
        pos.product.data.performanceValue.set(6, (positionDATA["26wk Avg Weekly Margin"] !== null && positionDATA["26wk Avg Weekly Margin"] !== undefined ? Number((positionDATA["26wk Avg Weekly Margin"].includes(",") ? positionDATA["26wk Avg Weekly Margin"].replaceAll(",", "") : positionDATA["26wk Avg Weekly Margin"])) : 0))     //Avg Weekly Margin 26wk
        pos.product.data.performanceValue.set(7, (positionDATA["Annual Mvmt"] !== null && positionDATA["Annual Mvmt"] !== undefined ? Number((positionDATA["Annual Mvmt"].includes(",") ? positionDATA["Annual Mvmt"].replaceAll(",", "") : positionDATA["Annual Mvmt"])) : 0))                //Avg Annual Mvmt
        pos.product.data.performanceValue.set(8, (positionDATA["Annual Sales"] !== null && positionDATA["Annual Sales"] !== undefined ? Number((positionDATA["Annual Sales"].includes(",") ? positionDATA["Annual Sales"].replaceAll(",", "") : positionDATA["Annual Sales"])) : 0))               //Avg Annual Sales
        pos.product.data.performanceValue.set(9, (positionDATA["Annual Margin"] !== null && positionDATA["Annual Margin"] !== undefined ? Number((positionDATA["Annual Margin"].includes(",") ? positionDATA["Annual Margin"].replaceAll(",", "") : positionDATA["Annual Margin"])) : 0))              //Avg Annual Margin
        pos.product.data.performanceValue.set(10, (positionDATA["26wk Mvmt"] !== null && positionDATA["26wk Mvmt"] !== undefined ? Number((positionDATA["26wk Mvmt"].includes(",") ? positionDATA["26wk Mvmt"].replaceAll(",", "") : positionDATA["26wk Mvmt"])) : 0))                 //Avg Mvmt 26wk
        pos.product.data.performanceValue.set(11, (positionDATA["26wk Sales"] !== null && positionDATA["26wk Sales"] !== undefined ? Number((positionDATA["26wk Sales"].includes(",") ? positionDATA["26wk Sales"].replaceAll(",", "") : positionDATA["26wk Sales"])) : 0))                //Avg Sales 26wk
        pos.product.data.performanceValue.set(12, (positionDATA["26wk Margin"] !== null && positionDATA["26wk Margin"] !== undefined ? Number((positionDATA["26wk Margin"].includes(",") ? positionDATA["26wk Margin"].replaceAll(",", "") : positionDATA["26wk Margin"])) : 0))               //Avg Margin 26wk
        pos.product.data.performanceValue.set(17, (positionDATA["Weeks from First Sold"] !== null && positionDATA["Weeks from First Sold"] !== undefined ? Number((positionDATA["Weeks from First Sold"].includes(",") ? positionDATA["Weeks from First Sold"].replaceAll(",", "") : positionDATA["Weeks from First Sold"])) : 0))     //Weeks from First Sold

      }
    }
  }

  positionDataUpdate0()
  await sleep(200)


  function positionDataUpdate() {
    for (let pos of posits) {
      pos.product.data.performanceValue.set(3, (pos.product.data.performanceValue.get(3) > 0 ? pos.product.data.performanceValue.get(3) : round2dp(((.6) * (posits.filter(z => specialGet(z, revistedblocks) === specialGet(pos, revistedblocks) && z.product.data.performanceValue.get(3) > 0).reduce((total, a) => total + a.product.data.performanceValue.get(3), 0) / posits.filter(z => specialGet(z, revistedblocks) === specialGet(pos, revistedblocks) && z.product.data.performanceValue.get(3) > 0).length)))))
      pos.product.data.performanceValue.set(2, (pos.product.data.performanceValue.get(2) > 0 ? pos.product.data.performanceValue.get(2) : round2dp(((.6) * (posits.filter(z => specialGet(z, revistedblocks) === specialGet(pos, revistedblocks) && z.product.data.performanceValue.get(2) > 0).reduce((total, a) => total + a.product.data.performanceValue.get(2), 0) / posits.filter(z => specialGet(z, revistedblocks) === specialGet(pos, revistedblocks) && z.product.data.performanceValue.get(2) > 0).length)))))
      pos.product.data.performanceValue.set(1, (pos.product.data.performanceValue.get(1) > 0 ? pos.product.data.performanceValue.get(1) : round2dp(((.6) * (posits.filter(z => specialGet(z, revistedblocks) === specialGet(pos, revistedblocks) && z.product.data.performanceValue.get(1) > 0).reduce((total, a) => total + a.product.data.performanceValue.get(1), 0) / posits.filter(z => specialGet(z, revistedblocks) === specialGet(pos, revistedblocks) && z.product.data.performanceValue.get(1) > 0).length)))))
    }
  }

  // positionDataUpdate()
  // await sleep(100)

  function removeNaNs() {
    for (let pos of posits) {
      if (isNaN(pos.product.data.performanceValue.get(1))) {
        pos.product.data.performanceValue.set(1, 0)
      }
      if (isNaN(pos.product.data.performanceValue.get(2))) {
        pos.product.data.performanceValue.set(2, 0)
      }
      if (isNaN(pos.product.data.performanceValue.get(3))) {
        pos.product.data.performanceValue.set(3, 0)
      }
    }

  }

  removeNaNs()
  await sleep(10)


  function positionDataUpdate2() {
    for (let pos of posits) {
      if (pos.product.data.performanceValue.get(3) === undefined) {
        pos.product.data.performanceValue.set(3, 0)
      }
      if (pos.product.data.performanceValue.get(2) === undefined) {
        pos.product.data.performanceValue.set(2, 0)
      }
      if (pos.product.data.performanceValue.get(1) === undefined) {
        pos.product.data.performanceValue.set(1, 0)
      }
      if (pos.product.upc === "0002840073740") {
        pos.merch.y.number.value = 1
        pos.facings.y = 2
      }
      pos.product.data.unitMovement = pos.product.data.performanceValue.get(1)


    }
  }

  positionDataUpdate2()
  await sleep(100)


  // function checkForPartyDipRemoval() {

  //   for (let pos of posits) {
  //     if (pos.product.data.performanceDesc.get(38).includes("PARTY") && pog.data.notes.includes("NO PARTY")) {
  //       pos.parent = null
  //     }
  //   }
  // }

  // checkForPartyDipRemoval()
  // await sleep(50)


  // function checkForDesc35ReTags() {

  //   for (let pos of posits) {
  //     if (pos.product.data.performanceDesc.get(38).includes("TAKI") && pog.data.desc.get(40).includes("TAKI")) {
  //       pos.product.data.performanceDesc.set(35, "TAKIS 1")
  //     }
  //   }
  // }

  // checkForDesc35ReTags()
  // await sleep(50)

  function clearAdHocData() {

    for (let pos of pog.positions) {
      pos.product.data.performanceValue.set(27, 0)

      pos.product.data.performanceValue.set(28, 0)

      pos.product.data.performanceValue.set(29, 0)

      pos.product.data.performanceValue.set(30, 0)
    }
  }

  clearAdHocData()
  await sleep(50)



  // function modifyMovement() {
  //   for (let pos of posits) {
  //     if (!pos.product.data.performanceDesc.get(38).includes("S")) continue
  //     let d45block = pos.product.data.performanceDesc.get(45)
  //     let d45blockSorted = posits.filter(z => z.product.data.performanceDesc.get(45) === d45block).sort((a, b) => b.product.data.performanceValue.get(1) - a.product.data.performanceValue.get(1))
  //     let d45blockCutOff = Math.ceil((d45blockSorted.length) * .25)
  //     let currentMvmt = pos.product.data.performanceValue.get(1)
  //     if (d45blockSorted.indexOf(pos) < d45blockCutOff) {
  //       pos.product.data.performanceValue.set(27, currentMvmt)
  //       pos.product.data.performanceValue.set(1, round2dp((.6 * currentMvmt),2))
  //     }

  //   }
  // }

  // modifyMovement()
  // await sleep(50)


  function removeNaNs() {
    for (let pos of posits) {
      if (isNaN(pos.product.data.performanceValue.get(1))) {
        pos.product.data.performanceValue.set(1, 0)
      }
      if (isNaN(pos.product.data.performanceValue.get(2))) {
        pos.product.data.performanceValue.set(2, 0)
      }
      if (isNaN(pos.product.data.performanceValue.get(3))) {
        pos.product.data.performanceValue.set(3, 0)
      }
    }

  }

  removeNaNs()
  await sleep(10)


  // function overrideMovement() {
  //   for (let row of mvmtOverrideFile) {
  //     let targetUPC = row.Target_UPC
  //     let referenceUPC = row.Reference_UPC
  //     let overrideFactor = Number(row.Adjustment_Factor)
  //     if (posits.filter(z => Number(referenceUPC) === Number(z.product.upc)).length === 0) continue
  //     if (posits.filter(z => Number(z.product.upc) === Number(targetUPC)).length === 0) continue
  //     let overrideproductMvmt = posits.find(z => Number(referenceUPC) === Number(z.product.upc)).product.data.performanceValue.get(1)
  //     let curMvmt = posits.find(z => Number(z.product.upc) === Number(targetUPC)).product.data.performanceValue.get(1)
  //     let overrideMvmt1 = round2dp((overrideFactor * overrideproductMvmt), 2)
  //     let overrideMvmt = overrideMvmt1 > 0 ? overrideMvmt1 : curMvmt
  //     if (overrideproductMvmt > 0) {
  //       posits.find(z => Number(z.product.upc) === Number(targetUPC)).product.data.performanceValue.set(1, overrideMvmt)
  //     }
  //   }
  // }

  // overrideMovement()
  // await sleep(100)


  await sleep(150)

  await sleep(500)
  pog.updateNodes
  console.log("Preparation Complete")


}


//#endregion


//#region OPTIMISE

// scoringFn = pos => {
//   packout = pos.planogramProduct.calculatedFields.capacity / (Number.isNaN(pos.product.data.value.get(6)) ? 1 : (pos.product.data.value.get(6) === 0 ? 1 : pos.product.data.value.get(6)))
//   dos = pos.planogramProduct.calculatedFields.actualDaysSupply
//   facings = pos.planogramProduct.calculatedFields.facings
//   numberOfpositions = pos.planogramProduct.positionsCount
//   prevfacings = (Number.isNaN(parseFloat(pos.product.data.performanceDesc.get(50))) ? 1 : parseFloat(pos.product.data.performanceDesc.get(50)))
//   return (packout > 1.5 ? 29 : 0) + (dos > 7 ? 10 : 0) + (dos > 5 ? 5 : 0) + (dos > 3 ? 3 : 0) + Math.min(50, (((facings + numberOfpositions) / facings) * dos)) + (((facings / numberOfpositions) > 4 ? 2 : 1) * (facings / numberOfpositions)) + ((facings - prevfacings) * ((facings - prevfacings) > 0 ? 5 : .5)) + (parseFloat(pos.product.upc) / 50000000000000)
// }

scoringFn = pos => {
  newItemDosPerFacing = !pos.desc38.includes("S") ? 25 : 19;
  numberOfpositions = pos.positionsCount;
  facings = pos.totFacings;
  dosOverride = facings * newItemDosPerFacing;
  uD43 = pos.desc43
  uMvmt = !uD43.includes("CEL") ? pos.unitMvmt : .1
  uD38 = pos.desc38
  p3DosBoost = facings >= 10 ? 1 : (!uD38.includes("S") ? 2.25 : 1.7)
  p5DosBoost = facings >= 10 ? 1 : (!uD38.includes("S") ? 1.7 : 1.35)
  p7DosBoost = facings >= 10 ? 1 : (!uD38.includes("S") ? 1.35 : 1.17)
  fBoost = facings > 15 ? 10 : (facings > 10 ? 7 : (facings >= 5 ? 2 : .25))
  regDOS = uMvmt > 0 ? (pos.totCapacity / uMvmt) * 7 : dosOverride;
  mvmtBoost = regDOS < 3 ? (p3DosBoost * uMvmt) : (regDOS < 5 ? (p5DosBoost * uMvmt) : (regDOS < 7 ? (p7DosBoost * uMvmt) : uMvmt))
  mvmtOverrideScore = Math.max(Math.max((2 - (regDOS / 50)), (1 - (regDOS / 5000))), (mvmtBoost - (fBoost * facings)))
  dos = uMvmt > 0 ? (pos.totCapacity / mvmtOverrideScore) * 7 : dosOverride;
  // prevfacings = (Number.isNaN(parseFloat(pos.product.data.performanceDesc.get(50))) ? 1 : parseFloat(pos.product.data.performanceDesc.get(50)))
  return (
    (((facings + numberOfpositions) / facings) * dos) / 250 +
    (dos > 3 ? 1 : 0) +
    (dos > 5 ? 2 : 0) +
    (dos > 7 ? 1.5 : 0) +
    (dos > 10 ? 1.5 : 0) +
    (facings / facings) * dos +
    parseFloat(pos.upc) / 50000000000000
  );
};


const optCache = {
  mapSG: new Map(),
  mapA: new Map(),
  mapA2: new Map(),
  mapA3: new Map(),
  mapAA: new Map(),
  mapB: new Map(),
  mapC: new Map(),
  mapD: new Map(),
  mapE: new Map(),
  mapF: new Map(),
  mapC2: new Map(),
  mapD2: new Map(),
  mapE2: new Map(),
  mapF2: new Map(),
  mapC3: new Map(),
  mapD3: new Map(),
  mapE3: new Map(),
  mapF3: new Map(),
  mapG: new Map(),
  mapG2: new Map(),
  mapG3: new Map(),
  mapOnly1: new Map(),
  mapFinalx: new Map(),
  mapS: new Map(),
};

function clearOptimiseCache() {
  optCache.mapSG = new Map();
  optCache.mapA = new Map();
  optCache.mapA2 = new Map();
  optCache.mapA3 = new Map();
  optCache.mapAA = new Map();
  optCache.mapB = new Map();
  optCache.mapC = new Map();
  optCache.mapD = new Map();
  optCache.mapE = new Map();
  optCache.mapF = new Map();
  optCache.mapC2 = new Map();
  optCache.mapD2 = new Map();
  optCache.mapE2 = new Map();
  optCache.mapF2 = new Map();
  optCache.mapC3 = new Map();
  optCache.mapD3 = new Map();
  optCache.mapE3 = new Map();
  optCache.mapF3 = new Map();
  optCache.mapG = new Map();
  optCache.mapG2 = new Map();
  optCache.mapG3 = new Map();
  optCache.mapOnly1 = new Map();
  optCache.mapFinalx = new Map();
  optCache.mapS = new Map();
}

const startTime = performance.now();
async function optimise(targetDoc, controller, resolveForPos = null) {
  specialGet = (a, key) => {
    let mapKey = a.uuid + key;
    let r = mapSG.get(mapKey);
    if (r) return r;
    let [keyA, keyB] = key.split(":");
    r = keyB ? _.get(a, keyA).get(keyB) : _.get(a, key);
    mapSG.set(mapKey, r);
    return r;
  };

  proj = targetDoc.data;
  pog = proj.planogram;
  fixs = pog.fixtures;
  posits = pog.positions; //.filter(z => !leavePosAlone(z))

  function populateNewPosits() {
    for (let pos of posits) {
      let newData = {};
      let fixLeftMost = pos.fixture.fixtureLeftMost;
      newData.upc = JSON.parse(JSON.stringify(pos.product.upc));
      newData.facingsX = Number(JSON.parse(JSON.stringify(pos.facings.x)));
      newData.merchSizeX = Number(JSON.parse(JSON.stringify(pos.merchSize.x)));
      newData.totCapacity = Number(
        JSON.parse(
          JSON.stringify(pos.planogramProduct.calculatedFields.capacity),
        ),
      );
      newData.unitMvmt = Number(
        JSON.parse(JSON.stringify(pos.product.data.performanceValue.get(1))),
      );
      newData.casePack = Number(
        JSON.parse(JSON.stringify(pos.product.data.value.get(6))),
      );
      newData.totFacings = Number(
        JSON.parse(
          JSON.stringify(pos.planogramProduct.calculatedFields.facings),
        ),
      );
      newData.positionsCount = Number(
        JSON.parse(JSON.stringify(pos.planogramProduct.positionsCount)),
      );
      newData.desc38 = JSON.parse(
        JSON.stringify(pos.product.data.performanceDesc.get(38)),
      );
      newData.desc45 = JSON.parse(
        JSON.stringify(pos.product.data.performanceDesc.get(45)),
      );
      newData.desc43 = JSON.parse(
        JSON.stringify(pos.product.data.performanceDesc.get(43)),
      );
      newData.blockname = JSON.parse(
        JSON.stringify(pos.product.data.performanceDesc.get(39)),
      );
      newData.isFrito = JSON.parse(
        JSON.stringify(pos.product.data.performanceDesc.get(43)),
      );
      newData.liftModifier = Number(
        JSON.parse(JSON.stringify(pos.product.data.performanceDesc.get(42))),
      );
      newData.largerblock = JSON.parse(
        JSON.stringify(pos.product.data.performanceDesc.get(36)),
      );
      newData.dividerblocks = JSON.parse(
        JSON.stringify(pos.product.data.performanceDesc.get(37)),
      );
      newData.fixUUID = JSON.parse(JSON.stringify(fixLeftMost.uuid));
      newData.dividersBetween = Number(
        JSON.parse(JSON.stringify(fixLeftMost.dividers.between)),
      );
      newData.dividersWidth = Number(
        JSON.parse(JSON.stringify(fixLeftMost.dividers.size.x)),
      );
      newData.dividersHeight = Number(
        JSON.parse(JSON.stringify(fixLeftMost.dividers.size.y)),
      );
      newData.dividersDepth = Number(
        JSON.parse(JSON.stringify(fixLeftMost.dividers.size.z)),
      );
      newData.dividersStart = Number(
        JSON.parse(
          JSON.stringify(fixLeftMost.dividers.atStart === true ? 1 : 0),
        ),
      );
      newData.dividersEnd = Number(
        JSON.parse(JSON.stringify(fixLeftMost.dividers.atEnd === true ? 1 : 0)),
      );

      newData.fixY = Number(
        JSON.parse(JSON.stringify(fixLeftMost.position.y)),
      );
      newData.hasDividers = Number(
        JSON.parse(
          JSON.stringify(
            fixLeftMost.dividers.size.z > 0 &&
              fixLeftMost.dividers.size.x > 0 &&
              fixLeftMost.dividers.size.y > 0
              ? 1
              : 0,
          ),
        ),
      );
      newData.combinedLinear = Number(
        JSON.parse(JSON.stringify(pos.fixture.calculatedFields.combinedLinear)),
      );
      newData.capPerFacings = Number(
        JSON.parse(
          JSON.stringify(
            Math.ceil(
              pos.planogramProduct.calculatedFields.capacity /
              pos.planogramProduct.calculatedFields.facings,
            ),
          ),
        ),
      );
      newPosits.push(newData);
    }
  }

  populateNewPosits();
  await sleep(500);

  // get posits (positions that we want to optimise)
  reducedPosits = newPosits.reduce((total, z) => {
    desc36info = z.largerblock;
    desc37info = z.dividerblocks;
    if (!total[desc36info]) total[desc36info] = {};
    if (!total[desc36info][desc37info]) total[desc36info][desc37info] = [];
    total[desc36info][desc37info].push(z);
    return total;
  }, {});

  reducedPosits2 = newPosits.reduce((total, z) => {
    desc36info = z.largerblock;
    desc37info = z.largerblock;
    if (!total[desc36info]) total[desc36info] = {};
    if (!total[desc36info][desc37info]) total[desc36info][desc37info] = [];
    total[desc36info][desc37info].push(z);
    return total;
  }, {});


  fourthShelfValue = newPosits.reduce((total, z) => {
    let fixtureY = z.fixY
    if (!total.includes(fixtureY)) total.push(fixtureY)
    return total
  }, []).sort((a, b) => a - b).at(3)

  reducedPosits3 = newPosits.reduce((total, z) => {


  })


  conditionMatchBlock = (a, b, group, group2) => {
    block1condition = specialGet(a, group) === specialGet(b, group);
    block2condition = specialGet(a, group2) === specialGet(b, group2);

    return group2 ? block1condition && block2condition : block1condition;
  };

  cached = (map, posit, fn) => {
    if (map.has(posit)) {
      return map.get(posit);
    }
    const r = fn(posit);
    map.set(posit, r);
    return r;
  };

  conditionGfunctionFn = posit =>
    round2dp(Number(posit.combinedLinear), 6) -
    round2dp(spaceAvailableModifier(posit), 6) -
    round2dp(largerBlockDividerSpace(posit), 6) -
    round2dp(
      positsOpt
        .filter(z => z.fixUUID === posit.fixUUID)
        .reduce(
          (total, item) =>
            total +
            (Number(item.hasDividers) === 1 &&
              Number(item.dividersBetween) > 0
              ? Number(item.dividersBetween) === 3
                ? Number(item.facingsX) * Number(item.dividersWidth)
                : Number(item.dividersWidth)
              : 0),
          0,
        ) -
      (Number(posit.hasDividers) > 0 && Number(posit.dividersBetween) > 0
        ? Number(posit.dividersWidth)
        : 0) +
      (Number(posit.hasDividers) > 0 && Number(posit.dividersStart) > 0
        ? Number(posit.dividersWidth)
        : 0) +
      (Number(posit.hasDividers) > 0 && Number(posit.dividersEnd) > 0
        ? Number(posit.dividersWidth)
        : 0),
      6,
    ) >=
    0;
  conditionGfunction = posit =>
    cached(optCache.mapG, posit, conditionGfunctionFn);

  conditionAfunctionFn = posit =>
    conditionGfunction(posit) &&
    Number(posit.merchSizeX) +
    (Number(posit.hasDividers) > 0 && Number(posit.dividersBetween) === 3
      ? Number(posit.dividersWidth)
      : 0) <=
    Number(posit.combinedLinear) -
    round2dp(largerBlockDividerSpace(posit), 6) -
    positsOpt
      .filter(z => z.fixUUID === posit.fixUUID)
      .reduce((total, a) => {
        return (total += Number(a.merchSizeX) * Number(a.facingsX));
      }, 0) -
    round2dp(
      positsOpt
        .filter(z => z.fixUUID === posit.fixUUID)
        .reduce(
          (total, item) =>
            total +
            (Number(item.hasDividers) === 1 &&
              Number(item.dividersBetween) > 0
              ? Number(item.dividersBetween) === 3
                ? Number(item.facingsX) * Number(item.dividersWidth)
                : Number(item.dividersWidth)
              : 0),
          0,
        ) -
      (Number(posit.hasDividers) > 0 && Number(posit.dividersBetween) > 0
        ? Number(posit.dividersWidth)
        : 0) +
      (Number(posit.hasDividers) > 0 && Number(posit.dividersStart) > 0
        ? Number(posit.dividersWidth)
        : 0) +
      (Number(posit.hasDividers) > 0 && Number(posit.dividersEnd) > 0
        ? Number(posit.dividersWidth)
        : 0),
      6,
    );
  conditionAfunction = posit =>
    cached(optCache.mapA, posit, conditionAfunctionFn);

  conditionAAfunctionFn = posit =>
    Number(posit.merchSizeX) +
    (Number(posit.hasDividers) > 0 && Number(posit.dividersBetween) === 3
      ? posit.dividersWidth
      : 0) <=
    Number(posit.combinedLinear) -
    positsOpt
      .filter(z => z.fixUUID === posit.fixUUID)
      .reduce((total, a) => {
        return (total += Number(a.merchSizeX) * Number(a.facingsX));
      }, 0) -
    round2dp(
      positsOpt
        .filter(z => z.fixUUID === posit.fixUUID)
        .reduce(
          (total, item) =>
            total +
            (Number(item.hasDividers) === 1 &&
              Number(item.dividersBetween) > 0
              ? Number(item.dividersBetween) === 3
                ? Number(item.facingsX) * Number(item.dividersWidth)
                : Number(item.dividersWidth)
              : 0),
          0,
        ) -
      (Number(posit.hasDividers) > 0 && Number(posit.dividersBetween) > 0
        ? Number(posit.dividersWidth)
        : 0) +
      (Number(posit.hasDividers) > 0 && Number(posit.dividersStart) > 0
        ? Number(posit.dividersWidth)
        : 0) +
      (Number(posit.hasDividers) > 0 && Number(posit.dividersEnd) > 0
        ? Number(posit.dividersWidth)
        : 0),
      6,
    );
  conditionAAfunction = posit =>
    cached(optCache.mapAA, posit, conditionAAfunctionFn);

  conditionG2functionFn = posit =>
    round2dp(Number(posit.combinedLinear), 6) -
    // round2dp(spaceAvailableModifier2(posit), 6) -
    round2dp(largerBlockDividerSpace(posit), 6) -
    round2dp(
      positsOpt
        .filter(z => z.fixUUID === posit.fixUUID)
        .reduce(
          (total, item) =>
            total +
            (Number(item.hasDividers) === 1 &&
              Number(item.dividersBetween) > 0
              ? Number(item.dividersBetween) === 3
                ? Number(item.facingsX) * Number(item.dividersWidth)
                : Number(item.dividersWidth)
              : 0),
          0,
        ) -
      (Number(posit.hasDividers) > 0 && Number(posit.dividersBetween) > 0
        ? Number(posit.dividersWidth)
        : 0) +
      (Number(posit.hasDividers) > 0 && Number(posit.dividersStart) > 0
        ? Number(posit.dividersWidth)
        : 0) +
      (Number(posit.hasDividers) > 0 && Number(posit.dividersEnd) > 0
        ? Number(posit.dividersWidth)
        : 0),
      6,
    ) >=
    0;
  conditionG2function = posit =>
    cached(optCache.mapG2, posit, conditionG2functionFn);

  conditionA2functionFn = posit =>
    conditionG2function(posit) &&
    Number(posit.merchSizeX) +
    (Number(posit.hasDividers) > 0 && Number(posit.dividersBetween) === 3
      ? Number(posit.dividersWidth)
      : 0) <=
    Number(posit.combinedLinear) -
    round2dp(largerBlockDividerSpace(posit), 6) -
    positsOpt
      .filter(z => z.fixUUID === posit.fixUUID)
      .reduce((total, a) => {
        return (total += Number(a.merchSizeX) * Number(a.facingsX));
      }, 0) -
    round2dp(
      positsOpt
        .filter(z => z.fixUUID === posit.fixUUID)
        .reduce(
          (total, item) =>
            total +
            (Number(item.hasDividers) === 1 &&
              Number(item.dividersBetween) > 0
              ? Number(item.dividersBetween) === 3
                ? Number(item.facingsX) * Number(item.dividersWidth)
                : Number(item.dividersWidth)
              : 0),
          0,
        ) -
      (Number(posit.hasDividers) > 0 && Number(posit.dividersBetween) > 0
        ? Number(posit.dividersWidth)
        : 0) +
      (Number(posit.hasDividers) > 0 && Number(posit.dividersStart) > 0
        ? Number(posit.dividersWidth)
        : 0) +
      (Number(posit.hasDividers) > 0 && Number(posit.dividersEnd) > 0
        ? Number(posit.dividersWidth)
        : 0),
      6,
    );
  conditionA2function = posit =>
    cached(optCache.mapA2, posit, conditionA2functionFn);


  //G3 and A3 are filling out within D37's
  conditionG3functionFn = posit =>
    round2dp(maxDividerSpaceModifier(posit), 6) -
    round2dp(dividerSpaceModifier(posit), 6) -
    round2dp(largerBlockDividerSpace(posit), 6) -
    round2dp(
      positsOpt
        .filter(z => z.fixUUID === posit.fixUUID)
        .reduce(
          (total, item) =>
            total +
            (Number(item.hasDividers) === 1 &&
              Number(item.dividersBetween) > 0
              ? Number(item.dividersBetween) === 3
                ? Number(item.facingsX) * Number(item.dividersWidth)
                : Number(item.dividersWidth)
              : 0),
          0,
        ) -
      (Number(posit.hasDividers) > 0 && Number(posit.dividersBetween) > 0
        ? Number(posit.dividersWidth)
        : 0) +
      (Number(posit.hasDividers) > 0 && Number(posit.dividersStart) > 0
        ? Number(posit.dividersWidth)
        : 0) +
      (Number(posit.hasDividers) > 0 && Number(posit.dividersEnd) > 0
        ? Number(posit.dividersWidth)
        : 0),
      6,
    ) >=
    0;
  conditionG3function = posit =>
    cached(optCache.mapG3, posit, conditionG3functionFn);

  conditionA3functionFn = posit =>
    conditionG3function(posit) &&
    Number(posit.merchSizeX) +
    (Number(posit.hasDividers) > 0 && Number(posit.dividersBetween) === 3
      ? Number(posit.dividersWidth)
      : 0) <=
    Number(posit.combinedLinear) -
    round2dp(largerBlockDividerSpace(posit), 6) -
    positsOpt
      .filter(z => z.fixUUID === posit.fixUUID)
      .reduce((total, a) => {
        return (total += Number(a.merchSizeX) * Number(a.facingsX));
      }, 0) -
    round2dp(
      positsOpt
        .filter(z => z.fixUUID === posit.fixUUID)
        .reduce(
          (total, item) =>
            total +
            (Number(item.hasDividers) === 1 &&
              Number(item.dividersBetween) > 0
              ? Number(item.dividersBetween) === 3
                ? Number(item.facingsX) * Number(item.dividersWidth)
                : Number(item.dividersWidth)
              : 0),
          0,
        ) -
      (Number(posit.hasDividers) > 0 && Number(posit.dividersBetween) > 0
        ? Number(posit.dividersWidth)
        : 0) +
      (Number(posit.hasDividers) > 0 && Number(posit.dividersStart) > 0
        ? Number(posit.dividersWidth)
        : 0) +
      (Number(posit.hasDividers) > 0 && Number(posit.dividersEnd) > 0
        ? Number(posit.dividersWidth)
        : 0),
      6,
    );
  conditionA3function = posit =>
    cached(optCache.mapA3, posit, conditionA3functionFn);

  // conditionAfunctionFn = posit => conditionGfunction(posit) && posit.merchSizeX <= (posit.fixture.calculatedFields.combinedLinear - posits.reduce((total, a) => {
  //   if (a.fixture.fixtureLeftMost.uuid === posit.fixture.fixtureLeftMost.uuid) {
  //     total += (a.merchSizeX * a.facingsX)
  //   }
  //   return total
  // }, 0))
  // conditionAfunction = posit => cached(mapA, posit, conditionAfunctionFn)

  // conditionAfunctionFn = posit => conditionGfunction(posit) && posit.merchSizeX <= (posit.fixture.calculatedFields.combinedLinear - posits.reduce((total, a) => {
  //   if (a.fixture.fixtureLeftMost.uuid === posit.fixture.fixtureLeftMost.uuid) {
  //     total += (a.merchSizeX * a.facingsX)
  //   }
  //   return total
  // }, 0))
  // conditionAfunction = posit => cached(mapA, posit, conditionAfunctionFn)

  spaceAvailableModifier = posit =>
    reducedPosits[posit.largerblock] &&
    Object.values(reducedPosits[posit.largerblock]).reduce((total, x) => {
      maxSpaceDesc37 = Object.values(
        x.reduce((total, z) => {
          fixtureLeftuuid = z.fixUUID;
          if (!total?.[fixtureLeftuuid]) total[fixtureLeftuuid] = 0;
          total[fixtureLeftuuid] += Number(z.merchSizeX) * Number(z.facingsX);

          // add an extra facing for the position we are wanting to expand
          if (z === posit) total[fixtureLeftuuid] += Number(posit.merchSizeX);

          return total;
        }, {}),
      ).reduce((total, z) => (total > z ? total : z), 0);

      return (total += maxSpaceDesc37);
    }, 0);

  maxDividerSpaceModifier = posit =>
    reducedPosits[posit.largerblock][posit.dividerblocks] &&
    Object.values(reducedPosits[posit.largerblock][posit.dividerblocks].reduce((total, x) => {
      let fixtureLeftuuid = x.fixUUID
      if (!total?.[fixtureLeftuuid]) total[fixtureLeftuuid] = 0;
      total[fixtureLeftuuid] += Number(x.merchSizeX) * Number(x.facingsX);

      // // add an extra facing for the position we are wanting to expand
      // if (x === posit) total[fixtureLeftuuid] += Number(posit.merchSizeX);

      return total;
    }, {})).reduce((total, z) => {
      return total = total > z ? total : z
    }, 0);


  dividerSpaceModifier = posit =>
    positsOpt
      .filter(
        z =>
          z.fixUUID === posit.fixUUID &&
          z.largerblock === posit.largerblock &&
          z.dividerblocks === posit.dividerblocks,
      ).reduce((total, x) => {
        total += Number(x.merchSizeX) * Number(x.facingsX);

        // add an extra facing for the position we are wanting to expand
        if (x === posit) total += Number(posit.merchSizeX);
        return total
      }, 0);


  spaceAvailableModifier2 = posit =>
    reducedPosits2[posit.largerblock] &&
    Object.values(reducedPosits2[posit.largerblock]).reduce((total, x) => {
      maxSpaceDesc37 = Object.values(
        x.reduce((total, z) => {
          fixtureLeftuuid = z.fixUUID;
          if (!total?.[fixtureLeftuuid]) total[fixtureLeftuuid] = 0;
          total[fixtureLeftuuid] += Number(z.merchSizeX) * Number(z.facingsX);

          // add an extra facing for the position we are wanting to expand
          if (z === posit) total[fixtureLeftuuid] += Number(posit.merchSizeX);

          return total;
        }, {}),
      ).reduce((total, z) => (total > z ? total : z), 0);

      return (total += maxSpaceDesc37);
    }, 0);

  largerBlockDividerSpace = posit =>
    reducedPosits[posit.largerblock] &&
    Object.values(reducedPosits[posit.largerblock]).reduce(
      (total, x, index) => {
        blockDividerSpace = index === 0 ? 0 : dividerWidthWithT;
        return (total += blockDividerSpace);
      },
      0,
    );

  conditionBfunctionFn = posit =>
    (posit.merchSizeX) +
    positsOpt
      .filter(
        z =>
          z.fixUUID === posit.fixUUID &&
          z.blockname === posit.blockname &&
          z.largerblock === posit.largerblock,
      )
      .reduce(
        (total, z) => total + Number(z.merchSizeX) * Number(z.facingsX),
        0
      ) -
    in2M(variables.flexspace) <
    Object.values(
      positsOpt
        .filter(
          z =>
            z.blockname === posit.blockname &&
            z.largerblock === posit.largerblock,
        )
        .reduce((total, z) => {
          fixtureLeftuuid = z.fixUUID;
          if (!total?.[fixtureLeftuuid]) total[fixtureLeftuuid] = 0;
          total[fixtureLeftuuid] += Number(z.merchSizeX) * Number(z.facingsX);
          return total;
        }, {}),
    ).reduce((total, z) => (total > z ? total : z), 0);
  conditionBfunction = posit =>
    cached(optCache.mapB, posit, conditionBfunctionFn);

  conditionCfunctionFn = posit =>
    scoringFn(posit) ===
    positsOpt
      .filter(
        z =>
          z.fixUUID === posit.fixUUID &&
          z.blockname === posit.blockname &&
          z.largerblock === posit.largerblock &&
          conditionBfunction(z) &&
          conditionAfunction(z),
      )
      .reduce((total, z) => {
        pscore = scoringFn(z);
        return total < pscore ? total : pscore;
      }, Infinity);
  conditionCfunction = posit =>
    cached(optCache.mapC, posit, conditionCfunctionFn);

  conditionC2functionFn = posit =>
    scoringFn(posit) ===
    positsOpt
      .filter(
        z =>
          z.fixUUID === posit.fixUUID &&
          z.blockname === posit.blockname &&
          z.largerblock === posit.largerblock &&
          conditionBfunction(z) &&
          conditionA2function(z),
      )
      .reduce((total, z) => {
        pscore = scoringFn(z);
        return total < pscore ? total : pscore;
      }, Infinity);
  conditionC2function = posit =>
    cached(optCache.mapC2, posit, conditionC2functionFn);

  conditionC3functionFn = posit =>
    scoringFn(posit) ===
    positsOpt
      .filter(
        z =>
          z.fixUUID === posit.fixUUID &&
          z.blockname === posit.blockname &&
          z.largerblock === posit.largerblock &&
          conditionBfunction(z) &&
          conditionA3function(z),
      )
      .reduce((total, z) => {
        pscore = scoringFn(z);
        return total < pscore ? total : pscore;
      }, Infinity);
  conditionC3function = posit =>
    cached(optCache.mapC3, posit, conditionC3functionFn);


  // condition D checks that there is a facing available on each shelf of a product group
  conditionDfunctionFn = posit =>
    positsOpt
      .filter(
        z =>
          z.blockname === posit.blockname &&
          z.largerblock === posit.largerblock &&
          conditionAfunction(z),
      )
      .reduce((total, z) => {
        if (!total.some(item => item === z.fixUUID)) {
          total.push(z.fixUUID);
        }
        return total;
      }, []).length ===
    positsOpt
      .filter(
        z =>
          z.blockname === posit.blockname &&
          z.largerblock === posit.largerblock,
      )
      .reduce((total, z) => {
        if (!total.some(item => item === z.fixUUID)) {
          total.push(z.fixUUID);
        }
        return total;
      }, []).length;
  conditionDfunction = posit =>
    cached(optCache.mapD, posit, conditionDfunctionFn);

  conditionD2functionFn = posit =>
    positsOpt
      .filter(
        z =>
          z.blockname === posit.blockname &&
          z.largerblock === posit.largerblock &&
          conditionA2function(z),
      )
      .reduce((total, z) => {
        if (!total.some(item => item === z.fixUUID)) {
          total.push(z.fixUUID);
        }
        return total;
      }, []).length ===
    positsOpt
      .filter(
        z =>
          z.blockname === posit.blockname &&
          z.largerblock === posit.largerblock,
      )
      .reduce((total, z) => {
        if (!total.some(item => item === z.fixUUID)) {
          total.push(z.fixUUID);
        }
        return total;
      }, []).length;
  conditionD2function = posit =>
    cached(optCache.mapD2, posit, conditionD2functionFn);


  conditionD3functionFn = posit =>
    positsOpt
      .filter(
        z =>
          z.blockname === posit.blockname &&
          z.largerblock === posit.largerblock &&
          conditionA3function(z),
      )
      .reduce((total, z) => {
        if (!total.some(item => item === z.fixUUID)) {
          total.push(z.fixUUID);
        }
        return total;
      }, []).length ===
    positsOpt
      .filter(
        z =>
          z.blockname === posit.blockname &&
          z.largerblock === posit.largerblock,
      )
      .reduce((total, z) => {
        if (!total.some(item => item === z.fixUUID)) {
          total.push(z.fixUUID);
        }
        return total;
      }, []).length;
  conditionD3function = posit =>
    cached(optCache.mapD3, posit, conditionD3functionFn);


  // condition Only On 1 Shelf checks that the Desc 37 & Desc 36 combo only appears on 1 fixture
  conditionOnly1ShelffunctionFn = posit =>
    positsOpt
      .filter(
        z =>
          z.dividerblocks === posit.dividerblocks &&
          z.largerblock === posit.largerblock,
      )
      .reduce((total, z) => {
        if (!total.some(item => item === z.fixUUID)) {
          total.push(z.fixUUID);
        }
        return total;
      }, []).length === 1;
  conditionOnly1Shelffunction = posit =>
    cached(optCache.mapOnly1, posit, conditionOnly1ShelffunctionFn);

  conditionEfunctionFn = posit =>
    scoringFn(posit) ===
    positsOpt
      .filter(
        z =>
          z.fixUUID === posit.fixUUID &&
          z.blockname === posit.blockname &&
          z.largerblock === posit.largerblock &&
          conditionDfunction(z) &&
          conditionAfunction(z),
      )
      .reduce((total, z) => {
        pscore = scoringFn(z);
        return total < pscore ? total : pscore;
      }, Infinity);
  conditionEfunction = posit =>
    cached(optCache.mapE, posit, conditionEfunctionFn);

  conditionE2functionFn = posit =>
    scoringFn(posit) ===
    positsOpt
      .filter(
        z =>
          z.fixUUID === posit.fixUUID &&
          z.blockname === posit.blockname &&
          z.largerblock === posit.largerblock &&
          conditionD2function(z) &&
          conditionA2function(z),
      )
      .reduce((total, z) => {
        pscore = scoringFn(z);
        return total < pscore ? total : pscore;
      }, Infinity);
  conditionE2function = posit =>
    cached(optCache.mapE2, posit, conditionE2functionFn);

  conditionE3functionFn = posit =>
    scoringFn(posit) ===
    positsOpt
      .filter(
        z =>
          z.fixUUID === posit.fixUUID &&
          z.blockname === posit.blockname &&
          z.largerblock === posit.largerblock &&
          conditionD3function(z) &&
          conditionA3function(z),
      )
      .reduce((total, z) => {
        pscore = scoringFn(z);
        return total < pscore ? total : pscore;
      }, Infinity);
  conditionE3function = posit =>
    cached(optCache.mapE3, posit, conditionE3functionFn);

  conditionFinalxfunctionFn = posit =>
    scoringFn(posit) ===
    positsOpt
      .filter(z => z.fixUUID === posit.fixUUID && conditionAAfunction(z))
      .reduce((total, z) => {
        pscore = scoringFn(z);
        return total < pscore ? total : pscore;
      }, Infinity);
  conditionFinalxfunction = posit =>
    cached(optCache.mapFinalx, posit, conditionFinalxfunctionFn);

  // condition F is group is the lowest need by group score
  conditionFfunction = posit => {
    positsADFn = () =>
      positsOpt.filter(
        z => z.largerblock === posit.largerblock && conditionEfunction(z),
      );
    positsAD = cached(optCache.mapF, posit.largerblock, positsADFn);
    // positsAD = positsADFn()

    blockScoreValue = block_Score(
      positsAD.filter(
        z =>
          z.blockname === posit.blockname &&
          z.largerblock === posit.largerblock,
      ),
    );

    bestBlockScoreValue = () =>
      positsAD.reduce((total, z) => {
        bname = z.blockname;
        lbname = z.largerblock;
        group = positsAD.filter(z2 => z2.blockname === bname);
        groupScore = block_Score(group);
        total = total < groupScore ? total : groupScore;
        return total;
      }, Infinity);
    positsADGroups = cached(
      optCache.mapF,
      posit.largerblock + "group",
      bestBlockScoreValue,
    );
    // positsADGroups = positsADGroupsFn()

    // bestBlockScoreValue = positsADGroups
    //   .reduce((total, z) => {
    //     bscore = block_Score(positsAD.filter(z2 => z2.blockname + z2.largerblock === z))
    //     return total < bscore ? total : bscore
    //   }, Infinity)

    return blockScoreValue === positsADGroups;
  };

  conditionF2function = posit => {
    positsADFn = () =>
      positsOpt.filter(
        z => z.largerblock === posit.largerblock && conditionE2function(z),
      );
    positsAD = cached(optCache.mapF2, posit.largerblock, positsADFn);
    // positsAD = positsADFn()

    blockScoreValue = block_Score(
      positsAD.filter(
        z =>
          z.blockname === posit.blockname &&
          z.largerblock === posit.largerblock,
      ),
    );

    bestBlockScoreValue = () =>
      positsAD.reduce((total, z) => {
        bname = z.blockname;
        lbname = z.largerblock;
        group = positsAD.filter(z2 => z2.blockname === bname);
        groupScore = block_Score(group);
        total = total < groupScore ? total : groupScore;
        return total;
      }, Infinity);
    positsADGroups = cached(
      optCache.mapF2,
      posit.largerblock + "group",
      bestBlockScoreValue,
    );
    // positsADGroups = positsADGroupsFn()

    // bestBlockScoreValue = positsADGroups
    //   .reduce((total, z) => {
    //     bscore = block_Score(positsAD.filter(z2 => z2.blockname + z2.largerblock === z))
    //     return total < bscore ? total : bscore
    //   }, Infinity)

    return blockScoreValue === positsADGroups;
  };

  conditionF3function = posit => {
    positsADFn = () =>
      positsOpt.filter(
        z => z.largerblock === posit.largerblock && conditionE3function(z),
      );
    positsAD = cached(optCache.mapF3, posit.largerblock, positsADFn);
    // positsAD = positsADFn()

    blockScoreValue = block_Score(
      positsAD.filter(
        z =>
          z.blockname === posit.blockname &&
          z.largerblock === posit.largerblock,
      ),
    );

    bestBlockScoreValue = () =>
      positsAD.reduce((total, z) => {
        bname = z.blockname;
        lbname = z.largerblock;
        group = positsAD.filter(z2 => z2.blockname === bname);
        groupScore = block_Score(group);
        total = total < groupScore ? total : groupScore;
        return total;
      }, Infinity);
    positsADGroups = cached(
      optCache.mapF3,
      posit.largerblock + "group",
      bestBlockScoreValue,
    );
    // positsADGroups = positsADGroupsFn()

    // bestBlockScoreValue = positsADGroups
    //   .reduce((total, z) => {
    //     bscore = block_Score(positsAD.filter(z2 => z2.blockname + z2.largerblock === z))
    //     return total < bscore ? total : bscore
    //   }, Infinity)

    return blockScoreValue === positsADGroups;
  };

  satisfiesBalancingCondition = posit => {
    return (
      conditionCfunction(posit) &&
      conditionBfunction(posit) &&
      conditionAfunction(posit)
    );
  };

  satisfiesExpansionCondition = posit => {
    return (
      conditionEfunction(posit) &&
      conditionFfunction(posit) &&
      conditionDfunction(posit) &&
      conditionAfunction(posit)
    );
  };

  satisfiesFinalExpansionCondition = posit => {
    return conditionFinalxfunction(posit) && conditionAAfunction(posit);
  };

  satisfiesOnly1ShelfCondition = posit => {
    return (
      conditionFinalxfunctionFn(posit) &&
      conditionOnly1ShelffunctionFn(posit) &&
      conditionAAfunctionFn(posit)
    );
  };

  // Scoring
  scoring = pos => cached(optCache.mapS, pos, scoringFn);

  if (resolveForPos) {
    switch (resolveForPos.condition) {
      case "A":
        return conditionAfunction(resolveForPos.pos);
      case "B":
        return conditionBfunction(resolveForPos.pos);
      case "C":
        return conditionCfunction(resolveForPos.pos);
      case "D":
        return conditionDfunction(resolveForPos.pos);
      case "E":
        return conditionEfunction(resolveForPos.pos);
      case "F":
        return conditionFfunction(resolveForPos.pos);
      case "G":
        return conditionGfunction(resolveForPos.pos);
      case "Balancing":
        return satisfiesBalancingCondition(resolveForPos.pos);
      case "Expansion":
        return satisfiesExpansionCondition(resolveForPos.pos);
      default:
        break;
    }
  }

  // everything to 1 dos

  // ob to 2 dos

  // everything to 2 dos

  // ob to 3 dos

  // ob to 2 facings

  // everything to 3 dos

  // dos

  // Group Scoring function
  function block_Score(blockGroup) {
    let totalScore = 0;
    let blockLength = 0;
    // let minScore = 10000;
    // let otherMinScore = 10000;
    for (let pos of blockGroup) {
      itemScore = scoringFn(pos);
      numberOfpos = pos.positionsCount;
      totalScore += Math.min((7 + (itemScore / 150)), itemScore) / numberOfpos;
      blockLength += 1 / numberOfpos;
      // minScore = Math.min(minScore, posScore)
      // otherMinScore = Math.min(otherMinScore, itemScore)
    }
    return (totalScore / blockLength) / 75;
  }

  await sleep(0);

  signal = controller.signal;

  //First Fill Out
  for (let largerBlock of Object.keys(reducedPosits)) {
    positsOpt = newPosits.filter(z => z.largerblock === largerBlock);
    if (
      positsOpt.reduce((total, item) => {
        let posFix = item.fixUUID;
        if (!total.some(z => z === posFix)) {
          total.push(posFix);
        }
        return total;
      }, []).length === 1
    ) {
      while (true) {
        // Final expansion for loop
        console.log("Only 1 Shelf Expansion step...");

        clearOptimiseCache();
        await sleep(10);
        positssSatisfyingOnly1ShelfExpansionCondition = positsOpt
          .filter(satisfiesOnly1ShelfCondition)
          .sort((a, b) => scoring(a) - scoring(b));
        if (positssSatisfyingOnly1ShelfExpansionCondition.length === 0) {
          console.log("Finished Only 1 Shelf optimisation...");
          break;
        }
        oneperFix2 = positssSatisfyingOnly1ShelfExpansionCondition.reduce(
          (total, z) => {
            if (!total.some(item => item.fixUUID === z.fixUUID)) {
              total.push(z);
            }
            return total;
          },
          [],
        );
        for (let pos of oneperFix2) {
          matchingPosits = positsOpt.filter(
            z => z.upc === pos.upc && z.fixUUID != pos.fixUUID,
          );
          pos.facingsX += 1;
          pos.totFacings += 1;
          pos.totCapacity += pos.capPerFacings;
          for (let p of matchingPosits) {
            p.totFacings += 1;
            p.totCapacity += pos.capPerFacings;
          }
          // console.log('upc '+pos.upc+'  score '+scoringFn(pos))
          //console.log(specialGet(pos, largerblock))
        }
        await sleep(100);

        if (signal.aborted) {
          console.log("Stopped");
          break;
        }
      }

    } else {
      // main loop
      while (true) {
        // balancing while loop
        console.log("Balancing step...");

        while (true) {
          clearOptimiseCache();
          await sleep(100);
          positssSatisfyingBalancingCondition = positsOpt
            .filter(z => conditionAfunction(z))
            .filter(z => conditionBfunction(z))
            .filter(z => conditionCfunction(z))
            .sort((a, b) => scoring(a) - scoring(b));
          if (positssSatisfyingBalancingCondition.length === 0) break;
          oneperFix = positssSatisfyingBalancingCondition.reduce((total, z) => {
            if (!total.some(item => item.fixUUID === z.fixUUID)) {
              total.push(z);
            }
            return total;
          }, []);
          for (let pos of oneperFix) {
            matchingPosits = positsOpt.filter(
              z => z.upc === pos.upc && z.fixUUID != pos.fixUUID,
            );
            pos.facingsX += 1;
            pos.totFacings += 1;
            pos.totCapacity += pos.capPerFacings;
            for (let p of matchingPosits) {
              p.totFacings += 1;
              p.totCapacity += pos.capPerFacings;
            }
            // console.log('upc '+pos.upc+'  score '+scoringFn(pos))
          }
          clearOptimiseCache();
          await sleep(100);
        }

        // expansion for loop
        console.log("Expansion step...");

        clearOptimiseCache();
        await sleep(100);
        positssSatisfyingExpansionCondition = positsOpt
          .filter(z => conditionEfunction(z))
          .filter(z => conditionFfunction(z))
          .sort((a, b) => scoring(a) - scoring(b));
        if (positssSatisfyingExpansionCondition.length === 0) {
          console.log("Finished optimisation...");
          break;
        }
        oneperFix2 = positssSatisfyingExpansionCondition.reduce((total, z) => {
          if (!total.some(item => item.fixUUID === z.fixUUID)) {
            total.push(z);
          }
          return total;
        }, []);
        for (let pos of oneperFix2) {
          matchingPosits = positsOpt.filter(
            z => z.upc === pos.upc && z.fixUUID != pos.fixUUID,
          );
          pos.facingsX += 1;
          pos.totFacings += 1;
          pos.totCapacity += pos.capPerFacings;
          for (let p of matchingPosits) {
            p.totFacings += 1;
            p.totCapacity += pos.capPerFacings;
          }
          // console.log('upc '+pos.upc+'  score '+scoringFn(pos))
          //console.log(specialGet(pos, largerblock))
        }
        clearOptimiseCache();
        await sleep(100);

        if (signal.aborted) {
          console.log("Stopped");
          break;
        }

      }

      // while (true) {
      //   // Final expansion for loop
      //   console.log("Final Expansion step...")

      //   clearOptimiseCache()
      //   positssSatisfyingFinalExpansionCondition = positsOpt.filter(satisfiesFinalExpansionCondition).sort((a, b) => scoring(a) - scoring(b));
      //   if (positssSatisfyingFinalExpansionCondition.length === 0) {
      //     console.log("Finished optimisation...")
      //     break
      //   }
      //   oneperFix2 = positssSatisfyingFinalExpansionCondition.reduce((total, z) => {
      //     if (!total.some(item => item.fixUUID === z.fixUUID)) {
      //       total.push(z)
      //     }
      //     return total
      //   }, [])
      //   for (let pos of oneperFix2) {
      //     matchingPosits = positsOpt.filter(z => z.upc === pos.upc && z.fixUUID != pos.fixUUID)
      //     pos.facingsX += 1
      //     pos.totFacings += 1
      //     pos.totCapacity += pos.capPerFacings
      //     for (let p of matchingPosits) {
      //       p.totFacings += 1
      //       p.totCapacity += pos.capPerFacings
      //     }
      //     //console.log(specialGet(pos, largerblock))
      //   }
      //   clearOptimiseCache()
      //   await sleep(100)

      //   if (signal.aborted) {
      //     console.log("Stopped")
      //     break;
      //   }
      // }
    }
  }

  //Second Fill Out - within desc 37's
  for (let largerBlock of Object.keys(reducedPosits)) {
    positsOpt = newPosits.filter(z => z.largerblock === largerBlock);
    if (
      positsOpt.reduce((total, item) => {
        let posFix = item.fixUUID;
        if (!total.some(z => z === posFix)) {
          total.push(posFix);
        }
        return total;
      }, []).length === 1
    ) {
      while (true) {
        // Final expansion for loop
        console.log("Only 1 Shelf Expansion step...");

        clearOptimiseCache();
        await sleep(10);
        positssSatisfyingOnly1ShelfExpansionCondition = positsOpt
          .filter(satisfiesOnly1ShelfCondition)
          .sort((a, b) => scoring(a) - scoring(b));
        if (positssSatisfyingOnly1ShelfExpansionCondition.length === 0) {
          console.log("Finished Only 1 Shelf optimisation...");
          break;
        }
        oneperFix2 = positssSatisfyingOnly1ShelfExpansionCondition.reduce(
          (total, z) => {
            if (!total.some(item => item.fixUUID === z.fixUUID)) {
              total.push(z);
            }
            return total;
          },
          [],
        );
        for (let pos of oneperFix2) {
          matchingPosits = positsOpt.filter(
            z => z.upc === pos.upc && z.fixUUID != pos.fixUUID,
          );
          pos.facingsX += 1;
          pos.totFacings += 1;
          pos.totCapacity += pos.capPerFacings;
          for (let p of matchingPosits) {
            p.totFacings += 1;
            p.totCapacity += pos.capPerFacings;
          }
          // console.log('upc '+pos.upc+'  score '+scoringFn(pos))
          //console.log(specialGet(pos, largerblock))
        }
        await sleep(100);

        if (signal.aborted) {
          console.log("Stopped");
          break;
        }
      }

    } else {
      // main loop
      while (true) {
        // balancing while loop
        console.log("Balancing step...");

        while (true) {
          clearOptimiseCache();
          await sleep(100);
          positssSatisfyingBalancingCondition = positsOpt
            .filter(z => conditionA3function(z))
            .filter(z => conditionBfunction(z))
            .filter(z => conditionC3function(z))
            .sort((a, b) => scoring(a) - scoring(b));
          if (positssSatisfyingBalancingCondition.length === 0) break;
          oneperFix = positssSatisfyingBalancingCondition.reduce((total, z) => {
            if (!total.some(item => item.fixUUID === z.fixUUID)) {
              total.push(z);
            }
            return total;
          }, []);
          for (let pos of oneperFix) {
            matchingPosits = positsOpt.filter(
              z => z.upc === pos.upc && z.fixUUID != pos.fixUUID,
            );
            pos.facingsX += 1;
            pos.totFacings += 1;
            pos.totCapacity += pos.capPerFacings;
            for (let p of matchingPosits) {
              p.totFacings += 1;
              p.totCapacity += pos.capPerFacings;
            }
            // console.log('upc '+pos.upc+'  score '+scoringFn(pos))
          }
          clearOptimiseCache();
          await sleep(100);
        }

        // expansion for loop
        console.log("Expansion step...");

        clearOptimiseCache();
        await sleep(100);
        positssSatisfyingExpansionCondition = positsOpt
          .filter(z => conditionE3function(z))
          .filter(z => conditionF3function(z))
          .sort((a, b) => scoring(a) - scoring(b));
        if (positssSatisfyingExpansionCondition.length === 0) {
          console.log("Finished optimisation...");
          break;
        }
        oneperFix2 = positssSatisfyingExpansionCondition.reduce((total, z) => {
          if (!total.some(item => item.fixUUID === z.fixUUID)) {
            total.push(z);
          }
          return total;
        }, []);
        for (let pos of oneperFix2) {
          matchingPosits = positsOpt.filter(
            z => z.upc === pos.upc && z.fixUUID != pos.fixUUID,
          );
          pos.facingsX += 1;
          pos.totFacings += 1;
          pos.totCapacity += pos.capPerFacings;
          for (let p of matchingPosits) {
            p.totFacings += 1;
            p.totCapacity += pos.capPerFacings;
          }
          // console.log('upc '+pos.upc+'  score '+scoringFn(pos))
          //console.log(specialGet(pos, largerblock))
        }
        clearOptimiseCache();
        await sleep(100);

        if (signal.aborted) {
          console.log("Stopped");
          break;
        }

      }

      // while (true) {
      //   // Final expansion for loop
      //   console.log("Final Expansion step...")

      //   clearOptimiseCache()
      //   positssSatisfyingFinalExpansionCondition = positsOpt.filter(satisfiesFinalExpansionCondition).sort((a, b) => scoring(a) - scoring(b));
      //   if (positssSatisfyingFinalExpansionCondition.length === 0) {
      //     console.log("Finished optimisation...")
      //     break
      //   }
      //   oneperFix2 = positssSatisfyingFinalExpansionCondition.reduce((total, z) => {
      //     if (!total.some(item => item.fixUUID === z.fixUUID)) {
      //       total.push(z)
      //     }
      //     return total
      //   }, [])
      //   for (let pos of oneperFix2) {
      //     matchingPosits = positsOpt.filter(z => z.upc === pos.upc && z.fixUUID != pos.fixUUID)
      //     pos.facingsX += 1
      //     pos.totFacings += 1
      //     pos.totCapacity += pos.capPerFacings
      //     for (let p of matchingPosits) {
      //       p.totFacings += 1
      //       p.totCapacity += pos.capPerFacings
      //     }
      //     //console.log(specialGet(pos, largerblock))
      //   }
      //   clearOptimiseCache()
      //   await sleep(100)

      //   if (signal.aborted) {
      //     console.log("Stopped")
      //     break;
      //   }
      // }
    }
  }

  //Third Fill out for blank spaces with blocking intact

  for (let largerBlock of Object.keys(reducedPosits2)) {
    positsOpt = newPosits.filter(z => z.largerblock === largerBlock);
    if (
      positsOpt.reduce((total, item) => {
        let posFix = item.fixUUID;
        if (!total.some(z => z === posFix)) {
          total.push(posFix);
        }
        return total;
      }, []).length === 1
    ) {
      while (true) {
        // Final expansion for loop
        console.log("Only 1 Shelf Expansion step...");

        clearOptimiseCache();
        await sleep(10);
        positssSatisfyingOnly1ShelfExpansionCondition = positsOpt
          .filter(satisfiesOnly1ShelfCondition)
          .sort((a, b) => scoring(a) - scoring(b));
        if (positssSatisfyingOnly1ShelfExpansionCondition.length === 0) {
          console.log("Finished Only 1 Shelf optimisation...");
          break;
        }
        oneperFix2 = positssSatisfyingOnly1ShelfExpansionCondition.reduce(
          (total, z) => {
            if (!total.some(item => item.fixUUID === z.fixUUID)) {
              total.push(z);
            }
            return total;
          },
          [],
        );
        for (let pos of oneperFix2) {
          matchingPosits = positsOpt.filter(
            z => z.upc === pos.upc && z.fixUUID != pos.fixUUID,
          );
          pos.facingsX += 1;
          pos.totFacings += 1;
          pos.totCapacity += pos.capPerFacings;
          for (let p of matchingPosits) {
            p.totFacings += 1;
            p.totCapacity += pos.capPerFacings;
          }
          // console.log('upc '+pos.upc+'  score '+scoringFn(pos))
          //console.log(specialGet(pos, largerblock))
        }
        await sleep(100);

        if (signal.aborted) {
          console.log("Stopped");
          break;
        }
      }

    } else {
      // main loop
      while (true) {
        // balancing while loop
        console.log("Balancing step...");

        while (true) {
          clearOptimiseCache();
          await sleep(100);
          positssSatisfyingBalancingCondition = positsOpt
            .filter(z => conditionA2function(z))
            .filter(z => conditionBfunction(z))
            .filter(z => conditionC2function(z))
            .sort((a, b) => scoring(a) - scoring(b));
          if (positssSatisfyingBalancingCondition.length === 0) break;
          oneperFix = positssSatisfyingBalancingCondition.reduce((total, z) => {
            if (!total.some(item => item.fixUUID === z.fixUUID)) {
              total.push(z);
            }
            return total;
          }, []);
          for (let pos of oneperFix) {
            matchingPosits = positsOpt.filter(
              z => z.upc === pos.upc && z.fixUUID != pos.fixUUID,
            );
            pos.facingsX += 1;
            pos.totFacings += 1;
            pos.totCapacity += pos.capPerFacings;
            for (let p of matchingPosits) {
              p.totFacings += 1;
              p.totCapacity += pos.capPerFacings;
            }
            // console.log('upc '+pos.upc+'  score '+scoringFn(pos))
          }
          clearOptimiseCache();
          await sleep(100);
        }

        // expansion for loop
        console.log("Expansion step...");

        clearOptimiseCache();
        await sleep(100);
        positssSatisfyingExpansionCondition = positsOpt
          .filter(z => conditionE2function(z))
          .filter(z => conditionF2function(z))
          .sort((a, b) => scoring(a) - scoring(b));
        if (positssSatisfyingExpansionCondition.length === 0) {
          console.log("Finished optimisation...");
          break;
        }
        oneperFix2 = positssSatisfyingExpansionCondition.reduce((total, z) => {
          if (!total.some(item => item.fixUUID === z.fixUUID)) {
            total.push(z);
          }
          return total;
        }, []);
        for (let pos of oneperFix2) {
          matchingPosits = positsOpt.filter(
            z => z.upc === pos.upc && z.fixUUID != pos.fixUUID,
          );
          pos.facingsX += 1;
          pos.totFacings += 1;
          pos.totCapacity += pos.capPerFacings;
          for (let p of matchingPosits) {
            p.totFacings += 1;
            p.totCapacity += pos.capPerFacings;
          }
          // console.log('upc '+pos.upc+'  score '+scoringFn(pos))
          //console.log(specialGet(pos, largerblock))
        }
        clearOptimiseCache();
        await sleep(100);

        if (signal.aborted) {
          console.log("Stopped");
          break;
        }
      }


      while (true) {
        // Final expansion for loop
        console.log("Final Expansion step...")

        clearOptimiseCache()
        positssSatisfyingFinalExpansionCondition = positsOpt.filter(satisfiesFinalExpansionCondition).sort((a, b) => scoring(a) - scoring(b));
        if (positssSatisfyingFinalExpansionCondition.length === 0) {
          console.log("Finished optimisation...")
          break
        }
        oneperFix2 = positssSatisfyingFinalExpansionCondition.reduce((total, z) => {
          if (!total.some(item => item.fixUUID === z.fixUUID)) {
            total.push(z)
          }
          return total
        }, [])
        for (let pos of oneperFix2) {
          matchingPosits = positsOpt.filter(z => z.upc === pos.upc && z.fixUUID != pos.fixUUID)
          pos.facingsX += 1
          pos.totFacings += 1
          pos.totCapacity += pos.capPerFacings
          for (let p of matchingPosits) {
            p.totFacings += 1
            p.totCapacity += pos.capPerFacings
          }
          //console.log(specialGet(pos, largerblock))
        }
        clearOptimiseCache()
        await sleep(100)

        if (signal.aborted) {
          console.log("Stopped")
          break;
        }
      }

    }
  }
  // change here 
  await sleep(100);
  for (let pos of posits) {
    let newFacings = newPosits.find(
      z =>
        pos.product.upc === z.upc &&
        z.fixUUID === pos.fixture.fixtureLeftMost.uuid,
    ).facingsX;
    pos.facings.x = newFacings;
  }
  console.log("Optimization Complete");
  console.log(
    "Planogram optimization took",
    (performance.now() - startTime).toFixed(2),
    "ms",
  );
}

//#endregion



//#region BLOCKING

async function blocking(targetDoc, returnCalcs = false) {
  proj = targetDoc.data
  pog = proj.planogram
  fixs = pog.fixtures
  await sleep(100)
  if (pog.positions.reduce((total, z) => {
    desc37info = specialGetUtil(z, dividerblocks)
    if (!total.some(item => item === desc37info)) {
      total.push(desc37info)
    }
    return total
  }, []).length === 1) {
    console.log("only 1 block, no dividers placed")
  } else {


    createDivider = (x, y, assembly, depth) => {
      targetDoc.createByDef(
        {
          type: "Fixture",
          isRaw: true,
          ftype: 10,
          name: "Bagged Snacks Divider",
          assembly: String(assembly),
          color: "-8355776",
          position: { x: x, y: y, z: 0 },
          width: dividerWidth, height: in2M(9), depth: depth
        },
        pog
      );
    }

    // get posits (positions that we want to optimise)
    posits = pog.positions//.filter(z => !leavePosAlone(z))

    getBlockDict = () => posits.reduce((total, z) => {
      desc36info = specialGetUtil(z, largerblock)
      desc37info = specialGetUtil(z, dividerblocks)
      if (!total[desc36info])
        total[desc36info] = {}
      if (!total[desc36info][desc37info])
        total[desc36info][desc37info] = []
      total[desc36info][desc37info].push(z)
      return total
    }, {})

    let reducedPosits = getBlockDict();
    let blockSizes = getBlockDict();

    Object.entries(blockSizes)
      .forEach(([desc36name, desc36block]) => {
        desc37blocks = Object.entries(desc36block)
        desc37blocks.forEach(([desc37name, positions]) => {
          // calculate the minimum x position
          minX = positions.reduce((total, z) => {
            return total < z.transform.worldPos.x ? total : z.transform.worldPos.x
          }, {})

          // calculate the maximum width when all the products are squeeze the most
          minSqu = Object.values(
            positions.reduce((total, z) => {
              fixtureLeftuuid = z.fixture.fixtureLeftMost.uuid
              if (!total?.[fixtureLeftuuid]) total[fixtureLeftuuid] = 0
              total[fixtureLeftuuid] += z.merchSize.x * z.facings.x
              return total
            }, {})).reduce((total, z) => total > z ? total : z, 0)

          // calculate the minimum width when all the products are expanded the most
          maxSqu = Object.values(
            positions.reduce((total, z) => {
              fixtureLeftuuid = z.fixture.fixtureLeftMost.uuid
              if (!total?.[fixtureLeftuuid]) total[fixtureLeftuuid] = 0
              total[fixtureLeftuuid] += z.merchSize.x * z.facings.x
              return total
            }, {})).reduce((total, z) => total < z ? total : z, Infinity)

          blockSizes[desc36name][desc37name] = { minSize: minSqu, maxSize: maxSqu, minX }
        })
      })

    Object.entries(blockSizes)
      .forEach(([desc36name, desc36block]) => {
        desc37blocks = Object.entries(desc36block).sort((a, b) => a[1].minX - b[1].minX)

        let xPos = 0;
        desc37blocks.forEach(([desc37name, info], index) => {
          block = blockSizes[desc36name][desc37name]

          positions = reducedPosits[desc36name][desc37name];
          fixtures = positions.reduce((total, z) => {
            fixtureLeft = z.fixture.fixtureLeftMost
            if (!total.includes(fixtureLeft)) total.push(fixtureLeft)
            return total
          }, []).sort((a, b) => b.position.y - a.position.y);

          worldOffset = fixtures[0].transform.worldPos.x

          block.fixtures = fixtures
          block.positions = positions

          // start of the positions
          block.xStart = xPos
          // end of the positions
          block.xEnd = xPos + block.minSize + dividerTolerance
          // start of the divider
          block.xDivider = xPos + block.minSize + dividerTolerance + worldOffset

          xPos += block.minSize + dividerWidthWithT
        })
      })

    if (returnCalcs)
      return blockSizes

    let mainBlock = { MAIN: blockSizes["MAIN"] }

    // remove all the positions
    for (let desc36block of Object.values(mainBlock)) {
      desc37blocks = Object.entries(desc36block).sort((a, b) => a[1].minX - b[1].minX)
      for (let [, info] of desc37blocks) {
        for (let pos of info.positions) {
          pos.oldParentUuid = pos.parent.fixtureLeftMost.uuid;
          pos.parent = null;
        }
      }
    }

    for (let [desc36name, desc36block] of Object.entries(mainBlock)) {
      desc37blocks = Object.entries(desc36block).sort((a, b) => a[1].minX - b[1].minX)
      numOfBlocks = desc37blocks.length

      let blockindex = -1;

      for (let [desc37name, info] of desc37blocks) {
        block = blockSizes[desc36name][desc37name]

        blockindex++

        let fixtures = block.fixtures
        let positions = block.positions

        for (let fixture of fixtures) {
          if (blockindex < numOfBlocks - 1)
            createDivider(info.xDivider, (fixture.position.y + fixture.height + in2M(1)), blockindex, fixture.depth);

          let fPos = positions.filter(p => p.oldParentUuid === fixture.uuid).sort((a, b) => a.rank.x - b.rank.x);

          let newPosX = block.xStart;
          for (let pos of fPos) {
            pos.parent = fixture;
            pos.position.x = newPosX;
            newPosX += 0.01;
          }
          fixture.layoutByRank();
          await sleep(5);


        }
      }
    }
  }
}


//#endregion

//#region Re-Opt
async function reOptPrep(targetDoc) {
  proj = targetDoc.data
  pog = proj.planogram
  fixs = pog.fixtures
  posits = pog.positions//.filter(z => !leavePosAlone(z))

  specialGet = (a, key) => {
    let mapKey = a.uuid + key
    let r = mapSG.get(mapKey)
    if (r) return r;
    let [keyA, keyB] = key.split(":");
    r = keyB ? _.get(a, keyA).get(keyB) : _.get(a, key)
    mapSG.set(mapKey, r)
    return r
  }

  await untidy(targetDoc);
  await sleep(500)


  pog.updateNodes()
  await sleep(50)

  reducedPosits = posits.reduce((total, z) => {
    desc36info = specialGet(z, largerblock)
    desc37info = specialGet(z, dividerblocks)
    if (!total[desc36info])
      total[desc36info] = {}
    if (!total[desc36info][desc37info])
      total[desc36info][desc37info] = []
    total[desc36info][desc37info].push(z)
    return total
  }, {})

  dividerBlocksRecalcWidths = {}

  for (let desc36 of Object.keys(reducedPosits)) {

    for (let dividerGrouping of Object.keys(reducedPosits[desc36])) {
      if (!(desc36 in dividerBlocksRecalcWidths)) dividerBlocksRecalcWidths[desc36] = {}
      dividerBlocksRecalcWidths[desc36][dividerGrouping] = Object.values(reducedPosits[desc36][dividerGrouping]
        .reduce((total, z) => {
          fixtureLeftuuid = z.fixture.fixtureLeftMost.uuid
          if (!total?.[fixtureLeftuuid]) total[fixtureLeftuuid] = 0
          total[fixtureLeftuuid] += z.merchSize.x * z.facings.x
          return total
        }, {}))
        .reduce((total, z) => (total > z ? total : z), 0)
    }
  }

  pog.dividerBlocksRecalcWidths = dividerBlocksRecalcWidths

  for (let pos of posits) {
    pos.merch.x.placement.value = 3
    pos.merch.x.size.value = 1
    if (pos.product.data.performanceDesc.get(37) === "MULTI" || pos.product.data.performanceDesc.get(37) === "MULTIPACK" || pos.product.data.performanceDesc.get(37) === " MULTIPACK") continue
    if (pos.product.data.performanceDesc.get(38) == "EXTRA") {
      pos.facings.x = 2;
    } else {
      pos.facings.x = 1;
    }
    if (pos.product.data.performanceDesc.get(38) === "PACKOUT" && Number(pog.data.desc.get(32)) >= 60) {
      pos.facings.x = 2
    }
  }


  await sleep(5);

}

mapSG = new Map()
mapA = new Map()
mapAA = new Map()
mapB = new Map()
mapC = new Map()
mapD = new Map()
mapE = new Map()
mapF = new Map()
mapG = new Map()
mapOnly1 = new Map()
mapFinalx = new Map()
mapS = new Map()

clearCache = (...args) => args.forEach((arg) => arg.clear())
// clearOptimiseCache = () => clearCache(mapA, mapAA, mapB, mapC, mapD, mapE, mapF, mapG, mapOnly1, mapFinalx, mapS)

async function reoptimise(targetDoc, controller, resolveForPos = null) {
  specialGet = (a, key) => {
    let mapKey = a.uuid + key
    let r = mapSG.get(mapKey)
    if (r) return r;
    let [keyA, keyB] = key.split(":");
    r = keyB ? _.get(a, keyA).get(keyB) : _.get(a, key)
    mapSG.set(mapKey, r)
    return r
  }

  proj = targetDoc.data
  pog = proj.planogram
  fixs = pog.fixtures

  // get posits (positions that we want to optimise)
  posits = pog.positions//.filter(z => !leavePosAlone(z))

  // reducedPosits = posits.reduce((total, z) => {
  //   desc36info = specialGet(z, largerblock)
  //   desc37info = specialGet(z, dividerblocks)
  //   if (!total[desc36info])
  //     total[desc36info] = {}
  //   if (!total[desc36info][desc37info])
  //     total[desc36info][desc37info] = []
  //   total[desc36info][desc37info].push(z)
  //   return total
  // }, {})


  // dividerBlocksRecalcWidths = {}

  // for (let desc36 of Object.keys(reducedPosits)) {

  //   for (let dividerGrouping of Object.keys(reducedPosits[desc36])) {
  //     if (!(desc36 in dividerBlocksRecalcWidths)) dividerBlocksRecalcWidths[desc36] = {}
  //     dividerBlocksRecalcWidths[desc36][dividerGrouping] = Object.values(reducedPosits[desc36][dividerGrouping]
  //       .reduce((total, z) => {
  //         fixtureLeftuuid = z.fixture.fixtureLeftMost.uuid
  //         if (!total?.[fixtureLeftuuid]) total[fixtureLeftuuid] = 0
  //         total[fixtureLeftuuid] += z.merchSize.x * z.facings.x
  //         return total
  //       }, {}))
  //       .reduce((total, z) => (total > z ? total : z), 0)
  //   }
  // }

  dividerBlocksRecalcWidths = pog.dividerBlocksRecalcWidths

  conditionMatchBlock = (a, b, group, group2) => {
    block1condition = specialGet(a, group) === specialGet(b, group)
    block2condition = specialGet(a, group2) === specialGet(b, group2)

    return group2 ? block1condition && block2condition : block1condition
  }

  cached = (map, posit, fn) => {
    let r = map.get(posit)
    if (r) return r;
    r = fn(posit)
    map.set(posit, r)
    return r
  }

  conditionIfunctionFn = posit => (round2dp(posit.merchSize.x, 6) <= (round2dp(dividerBlocksRecalcWidths[specialGet(posit, largerblock)][specialGet(posit, dividerblocks)], 6) - round2dp(posits
    .filter(z => z.fixture.fixtureLeftMost.uuid === posit.fixture.fixtureLeftMost.uuid && conditionMatchBlock(z, posit, dividerblocks, dividerblocks)) // need to check this part in more detail
    .reduce((total, z) => total + z.merchSize.x * z.facings.x, 0), 6) + ((.4) * dividerTolerance))) && (round2dp(posit.merchSize.x, 6) < (round2dp(posit.fixture.calculatedFields.combinedLinear, 6) - round2dp(posits.filter(z => z.fixture.fixtureLeftMost.uuid === posit.fixture.fixtureLeftMost.uuid).reduce((total, z) => total + z.merchSize.x * z.facings.x, 0), 6)))
  conditionIfunction = posit => cached(mapI, posit, conditionIfunctionFn)

  conditionJfunctionFn = posit => (posit.merchSize.x + (posits
    .filter(z => z.fixture.fixtureLeftMost.uuid === posit.fixture.fixtureLeftMost.uuid && conditionMatchBlock(z, posit, revistedblocks, dividerblocks))
    .reduce((total, z) => total + z.merchSize.x * z.facings.x, 0)))
    <= Object.values(
      posits
        .filter(z => conditionMatchBlock(z, posit, revistedblocks, dividerblocks))
        .reduce((total, z) => {
          fixtureLeftuuid = z.fixture.fixtureLeftMost.uuid
          if (!total?.[fixtureLeftuuid]) total[fixtureLeftuuid] = 0
          total[fixtureLeftuuid] += z.merchSize.x * z.facings.x
          return total
        }, {}))
      .reduce((total, z) => (total > z ? total : z), 0)
  conditionJfunction = posit => cached(mapJ, posit, conditionJfunctionFn)


  conditionKfunctionFn = posit => scoring(posit) === (posits
    .filter(z => z.fixture.fixtureLeftMost.uuid === posit.fixture.fixtureLeftMost.uuid && conditionMatchBlock(z, posit, revistedblocks, dividerblocks) && conditionIfunction(z) && conditionLfunction(z))
    .reduce((total, z) => {
      pscore = scoring(z)
      return total < pscore ? total : pscore
    }, Infinity))
  conditionKfunction = posit => cached(mapK, posit, conditionKfunctionFn)

  conditionNfunctionFn = posit => scoring(posit) === (posits
    .filter(z => z.fixture.fixtureLeftMost.uuid === posit.fixture.fixtureLeftMost.uuid && conditionMatchBlock(z, posit, revistedblocks, dividerblocks) && conditionIfunction(z) && conditionJfunction(z))
    .reduce((total, z) => {
      pscore = scoring(z)
      return total < pscore ? total : pscore
    }, Infinity))
  conditionNfunction = posit => cached(mapN, posit, conditionNfunctionFn)

  conditionFinalfunctionFn = posit => scoring(posit) === (posits
    .filter(z => z.fixture.fixtureLeftMost.uuid === posit.fixture.fixtureLeftMost.uuid && conditionMatchBlock(z, posit, dividerblocks, dividerblocks) && conditionIfunction(z) && z.planogramProduct.positions.length === 1)
    .reduce((total, z) => {
      pscore = scoring(z)
      return total < pscore ? total : pscore
    }, Infinity))
  conditionFinalfunction = posit => cached(mapFinal, posit, conditionFinalfunctionFn)


  conditionLfunctionFn = posit => (posits
    .filter(z => conditionMatchBlock(z, posit, revistedblocks, dividerblocks) && conditionIfunction(z))
    .reduce((total, z) => {
      if (!total.some(item => item === z.fixture.fixtureLeftMost.uuid)) {
        total.push(z.fixture.fixtureLeftMost.uuid)
      }
      return total
    }, []).length) === (posits
      .filter(z => conditionMatchBlock(z, posit, revistedblocks, dividerblocks))
      .reduce((total, z) => {
        if (!total.some(item => item === z.fixture.fixtureLeftMost.uuid)) {
          total.push(z.fixture.fixtureLeftMost.uuid)
        }
        return total
      }, []).length)
  conditionLfunction = posit => cached(mapL, posit, conditionLfunctionFn)


  conditionMfunction = posit => {
    positsILFn = () => posits.filter(z => conditionIfunction(z) && conditionLfunction(z) & conditionKfunction(z) & conditionMatchBlock(z, posit, dividerblocks, dividerblocks))
    positsIL = cached(mapM, specialGet(posit, dividerblocks), positsILFn)

    blockScoreValue = block_Score(positsIL.filter(z => conditionMatchBlock(z, posit, revistedblocks, dividerblocks)))

    positsILGroupsFn = () => positsIL
      .reduce((total, z) => {
        bname = specialGet(z, revistedblocks)
        lbname = specialGet(z, dividerblocks)
        group = bname + lbname
        if (!total.some(item => item === group)) {
          total.push(group)
        }
        return total
      }, [])
    positsILGroups = cached(mapM, specialGet(posit, dividerblocks) + "group", positsILGroupsFn)

    bestBlockScoreValue = positsILGroups.filter(z => z.includes(specialGet(posit, dividerblocks)))
      .reduce((total, z) => {
        bscore = block_Score(positsIL.filter(z2 => specialGet(z2, revistedblocks) + specialGet(z2, dividerblocks) === z))
        return total < bscore ? total : bscore
      }, Infinity)

    // console.log(specialGet(posit, revistedblocks), blockScoreValue, bestBlockScoreValue)

    return blockScoreValue === bestBlockScoreValue
  }


  satisfiesRevisitedBalancingCondition = posit => {
    return conditionIfunction(posit) && conditionJfunction(posit) && conditionNfunction(posit)
  }

  satisfiesRevisitedExpansionCondition = posit => {
    return conditionIfunction(posit) && conditionLfunction(posit) && conditionKfunction(posit) && conditionMfunction(posit)
  }



  // Scoring
  scoring = pos => cached(mapS, pos, scoringFn)


  if (resolveForPos) {
    switch (resolveForPos.condition) {
      case "I":
        return conditionIfunction(resolveForPos.pos)
      case "J":
        return conditionJfunction(resolveForPos.pos)
      case "K":
        return conditionKfunction(resolveForPos.pos)
      case "L":
        return conditionLfunction(resolveForPos.pos)
      case "M":
        return conditionMfunction(resolveForPos.pos)
      case "N":
        return conditionNfunction(resolveForPos.pos)
      case "H":
        return conditionHfunction(resolveForPos.pos)
      case "Balancing":
        return satisfiesRevisitedBalancingCondition(resolveForPos.pos)
      case "Expansion":
        return satisfiesRevisitedExpansionCondition(resolveForPos.pos)
      default:
        break
    }
  }


  // Group Scoring function
  function block_Score(blockGroup) {
    let totalScore = 0;
    let blockLength = 0;
    // let minScore = 10000;
    // let otherMinScore = 10000;
    for (let pos of blockGroup) {
      itemScore = scoring(pos)
      numberOfpos = pos.planogramProduct.positionsCount
      totalScore += Math.min((10 + (itemScore / 250)), itemScore) / numberOfpos
      blockLength += 1 / numberOfpos
      // minScore = Math.min(minScore, posScore)
      // otherMinScore = Math.min(otherMinScore, itemScore)

    }
    return (((totalScore / blockLength) / 500))
  }
  await sleep(0);

  signal = controller.signal;

  // main loop
  while (true) {
    // balancing while loop
    console.log("Balancing step...")

    while (true) {
      clearReOptimiseCache()
      positssSatisfyingRevisitedBalancingCondition = posits.filter(satisfiesRevisitedBalancingCondition).sort((a, b) => scoring(a) - scoring(b));
      if (positssSatisfyingRevisitedBalancingCondition.length === 0) break
      oneperFixBlock = positssSatisfyingRevisitedBalancingCondition.reduce((total, z) => {
        if (!total.some(item => _.get(item, 'fixture.fixtureLeftMost.uuid') === _.get(z, 'fixture.fixtureLeftMost.uuid') && specialGet(item, dividerblocks) === specialGet(z, dividerblocks))) {
          total.push(z)
        }
        return total
      }, [])
      for (let pos of oneperFixBlock) {
        pos.facings.x += 1
      }

      await sleep(0)
    }
    // expansion for loop
    console.log("Expansion step...")

    clearReOptimiseCache()
    positssSatisfyingRevisitedExpansionCondition = posits.filter(satisfiesRevisitedExpansionCondition).sort((a, b) => scoring(a) - scoring(b));
    //console.log(mapM)
    if (positssSatisfyingRevisitedExpansionCondition.length === 0) {
      console.log("Finished optimisation...")
      break
    }
    for (let pos of positssSatisfyingRevisitedExpansionCondition) {
      pos.facings.x += 1
    }
    await sleep(0)

    if (signal.aborted) {
      console.log("Stopped")
      break;
    }
  }

  // satisfiesFinalConditions = posit => {
  //   return conditionIfunction(posit) && conditionFinalfunction(posit)
  // }
  // while (true) {
  //   clearReOptimiseCache()
  //   positsSatisfyingFinalConditions = posits.filter(satisfiesFinalConditions).sort((a, b) => scoring(a) - scoring(b));
  //   if (positsSatisfyingFinalConditions.length === 0) {
  //     console.log("Finished Final optimisation...")
  //     break
  //   }
  //   for (let pos of positsSatisfyingFinalConditions) {
  //     pos.facings.x += 1
  //   }
  //   await sleep(0)
  // }
}

//#endregion


//#region Sub-Planogram Optimization
async function subPlanogramPrepare(targetDoc, templateDoc) {

  blockname = 'product.data.performanceDesc:35'
  largerblock = 'product.data.performanceDesc:36'
  dividerblocks = 'product.data.performanceDesc:37'
  dividerAltblocks = 'product.data.performanceDesc:46'
  revistedblocks = 'product.data.performanceDesc:39'
  dividerblocks2 = 'data.performanceDesc:37'
  dipDividerBlock = 'product.data.performanceDesc:45'
  dipDividerAltBlock = 'product.data.performanceDesc:47'
  assortAdd = 'product.data.performanceFlag:6'
  dipPosBlock = 'desc:30'
  dividerWidth = in2M(0.5)
  dividerTolerance = in2M(0.15)
  templateProj = templateDoc.data;
  templatePOG = templateProj.planogram
  proj = targetDoc.data
  pog = targetDoc.data.planogram
  fixs = targetDoc.data.planogram.fixtures
  posits = targetDoc.data.planogram.positions
  dividerWidth = in2M(0.5)

  function in2M(value) {
    return value * .0254
  }

  REVERSE_FLOW = pog.data.trafficFlow === 2

  function leavePosAlone(pos) {
    if (pos.fixture.segment.fixturesIn.size > 5) {
      sorted_fixs = pos.fixture.segment.fixturesIn.filter(f => f.name !== "Bagged Snacks Divider" && f.depth > .1).sort((a, b) => a.position.y - b.position.y)
      if (sorted_fixs.at(4) === pos.fixture)
        return true
    }
  }

  mapSG2 = new Map()


  specialGet = (a, key) => {
    let mapKey = a.uuid + key
    let r = mapSG2.get(mapKey)
    if (r) return r;
    let [keyA, keyB] = key.split(":");
    r = keyB ? _.get(a, keyA).get(keyB) : _.get(a, key)
    mapSG2.set(mapKey, r)
    return r
  }

  cached = (map, posit, fn) => {
    let r = map.get(posit)
    if (r) return r;
    r = fn(posit)
    map.set(posit, r)
    return r
  }

  function round2dp(v, dp = 2) {
    return Math.round(v * 10 ** dp) / 10 ** dp
  }



  await sleep(0)
  //Getting list of Dip Divider Blocks in POG

  // listofDipDividerBlocks = posits.filter(z => specialGet(z, dividerblocks) != "MULTI" && specialGet(z, dividerblocks) != " MULTIPACK" && specialGet(z, dividerblocks) != "MULTIPACK" && !leavePosAlone(z)).reduce((total, pos) => {
  //   posDipDividerBlock = specialGet(pos, dipDividerBlock)
  //   if (!total.includes(posDipDividerBlock)) {
  //     total.push(posDipDividerBlock)
  //   }
  //   return total
  // }, [])

  desc37sInTarget = pog.data.desc.get(40)

  dipItemsInTemplate = templatePOG.positions.filter(z => desc37sInTarget.includes(specialGet(z, dividerblocks)) || desc37sInTarget.includes(specialGet(z, dividerAltblocks))).filter(z2 => leavePosAlone(z2))

  console.log("got here")



  dividers = fixs.filter(z => z.width < .1)
  dividersX = dividers.reduce((total, div) => {
    fixX = div.transform.worldPos.x
    if (!total.includes(fixX)) {
      total.push(fixX)
    }
    return total
  }, [])



  dips = posits.filter(z => leavePosAlone(z))
  dipY = dips.reduce((total, dip) => dip.transform.worldPos.y + .01 > total ? dip.transform.worldPos.y + .01 : total, 0)
  dipFixtureY = dips.reduce((total, pos) => pos.fixture.transform.worldPos.y > total ? pos.fixture.transform.worldPos.y : total, 0)
  dipFixtures = fixs.filter(z => dipFixtureY === z.transform.worldPos.y)
  dipDepth = dips.reduce((total, dip) => dip.fixture.depth > total ? dip.fixture.depth : total, 0)

  function dipMerchSettings() {
    for (let dip of dips) {
      dip.merch.x.size.value = 1
      dip.merch.x.placement.value = 3
    }
  }

  dipMerchSettings()
  await sleep(25)

  function delDipDeletesFn() {
    for (let dip of dips) {
      let dipUPC = dip.product.upc
      if (dipUPC === "0002840069880") {
        dip.parent = null
      }
    }
  }

  delDipDeletesFn()
  await sleep(50)

  // #region
  // function removeDips() {
  //   for (let dip of dips) {
  //     dip.parent = null
  //   }
  // }

  // removeDips()
  // await sleep(1000)



  // createDivider = (x, y, assembly, depth) => {
  //   targetDoc.createByDef(
  //     {
  //       type: "Fixture",
  //       isRaw: true,
  //       ftype: 10,
  //       name: "dip divider",
  //       assembly: String(assembly),
  //       color: "-8355776",
  //       position: { x: x, y: y, z: 0 },
  //       width: dividerWidth, height: in2M(4.5), depth: depth
  //     },
  //     pog
  //   );
  // }

  // function placeDipDividers() {
  //   for (let dipDivider of listofDipDividerBlocks) {
  //     minXofDipDividers = posits.filter(z => specialGet(z, dipDividerBlock) === dipDivider && !leavePosAlone(z)).reduce((total, z) => z.transform.worldPos.x < total ? z.transform.worldPos.x : total, Infinity)
  //     if (dividersX.filter(z => z <= (minXofDipDividers + .05) && z >= (minXofDipDividers - .1)).length > 0) {
  //       newDipDividerX = dividersX.filter(z => z <= (minXofDipDividers + .05) && z >= (minXofDipDividers - .1)).at(0)
  //       createDivider(newDipDividerX, dipY, "dip divider", dipDepth)
  //     }
  //   }
  // }

  // await sleep(10)
  // placeDipDividers()
  // await sleep(10)

  // function copyPosition(position, doc, fixture) {
  //   const newPosData = position.valuesByTracker("@copy");

  //   return doc.createByDef(
  //     {
  //       type: "Position",
  //       isRaw: true,
  //       ...newPosData,
  //       merchStyle: 0
  //       //product: newProduct,
  //     },
  //     fixture
  //   );
  // }

  // function productsToArray(xs) {
  //   let rv = []
  //   for (let [, x] of xs) {
  //     rv.push(x)
  //   }
  //   return rv
  // };

  // prodsOnTarg = productsToArray(proj.products).filter(z => desc37sInTarget.includes(specialGet(z, dividerblocks2))).map(p => p.id + '_' + p.upc)
  // prodsOnTargUPConly = productsToArray(proj.products).filter(z => desc37sInTarget.includes(specialGet(z, dividerblocks2))).map(p => p.upc)

  // async function placeProducts() {
  //   rankX = 1
  //   for (let dipDivider of listofDipDividerBlocks) {
  //     dipsInBlock = dipItemsInTemplate.filter(z => dipDivider === specialGet(z, dipDividerBlock) || dipDivider === specialGet(z, dipDividerAltBlock))
  //     dipsInBlock = dipsInBlock.sort((a, b) => (a.transform.worldPos.x - b.transform.worldPos.x) * (REVERSE_FLOW ? -1 : 1))
  //     minXofDipDividers = posits.filter(z => specialGet(z, dipDividerBlock) === dipDivider && !leavePosAlone(z)).reduce((total, z) => z.transform.worldPos.x < total ? z.transform.worldPos.x : total, Infinity)
  //     targFix = dipFixtures.find(fix => fix.transform.worldPos.x <= minXofDipDividers && (fix.transform.worldPos.x + fix.width) >= minXofDipDividers)
  //     startX = (minXofDipDividers + .1) - targFix.transform.worldPos.x
  //     for (let pos of dipsInBlock) {
  //       let newpos = copyPosition(pos, targetDoc, targFix)

  //       newpos.position.x = startX
  //       startX += .1
  //       newpos.rank.x = rankX
  //       rankX += 1
  //       if (templatePOG.data.desc.get(50) === "BELOW CORE") {
  //         newpos.facings.x = 2
  //       } else {
  //         newpos.facings.x = 3
  //       }
  //       newpos.desc.set(30, dipDivider)
  //       sleep(15)


  //     }
  //     targFix.layoutByRank();


  //   }
  // }

  // await sleep(1000)
  // placeProducts()
  // await sleep(1000)

  // pog.updateNodes()

  // function copyToPositionDesc() {
  //   for (let pos of posits.filter(z => !leavePosAlone(z))) {
  //     pos.desc.set(30, pos.product.data.performanceDesc.get(45))

  //   }
  // }

  // copyToPositionDesc()
  // await sleep(10)

  // function setDipStyles() {
  //   for (let pos of posits.filter(z => leavePosAlone(z))) {
  //     pos.merch.x.placement.value = 3
  //     pos.merch.x.size.value = 1

  //   }
  // }

  // await sleep(10)
  // setDipStyles()
  // await sleep(10)

  // scoringFn = pos => {
  //   packout = pos.planogramProduct.calculatedFields.capacity / (Number.isNaN(pos.product.data.value.get(6)) ? 1 : (pos.product.data.value.get(6) === 0 ? 1 : pos.product.data.value.get(6)))
  //   numberOfpositions = pos.planogramProduct.positionsCount
  //   facings = pos.planogramProduct.calculatedFields.facings
  //   dos = pos.product.data.performanceValue.get(1) > 0 ? ((pos.planogramProduct.calculatedFields.capacity / pos.product.data.performanceValue.get(1)) * 7) : (5 * (facings / numberOfpositions))
  //   prevfacings = (Number.isNaN(parseFloat(pos.product.data.performanceDesc.get(50))) ? 1 : parseFloat(pos.product.data.performanceDesc.get(50)))
  //   return (packout >= 1.5 ? 9 : 0) + (dos > 7 ? 3 : 0) + (dos > 5 ? 2 : 0) + (dos > 3 ? 1.5 : 0) + (dos > 2 ? 1 : 0) + Math.min(31, (((facings + numberOfpositions) / facings) * dos)) + (((facings /* / numberOfpositions */) > 15 ? 2 : 1) * (facings /* / numberOfpositions */)) + ((facings - prevfacings) * ((facings - prevfacings) > 0 ? 5 : .5)) + (parseFloat(pos.product.upc) / 50000000000000)
  // }

  // scoring = pos => cached(mapS, pos, scoringFn)



  // mapDipEx1 = new Map()
  // mapDipEx2 = new Map()
  // mapDipEx3 = new Map()
  // mapS = new Map()

  // clearCache = (...args) => args.forEach((arg) => arg.clear())
  // clearDipCache = () => clearCache(mapDipEx1, mapDipEx2, mapDipEx3, mapS)


  // async function dipInitialExpansion() {
  //   for (let dipDivider of listofDipDividerBlocks) {
  //     // console.log(dipDivider)
  //     minXDivider = posits.filter(z => specialGet(z, dipDividerBlock) === dipDivider && !leavePosAlone(z)).reduce((total, z) => z.transform.worldPos.x < total ? z.transform.worldPos.x : total, Infinity)
  //     maxXDivider = posits.filter(z => specialGet(z, dipDividerBlock) === dipDivider && !leavePosAlone(z)).reduce((total, z) => (z.transform.worldPos.x + (z.merchSize.x * z.facings.x)) > total ? (z.transform.worldPos.x + (z.merchSize.x * z.facings.x)) : total, 0)
  //     dipsInDivider = targetDoc.data.planogram.positions.filter(z => leavePosAlone(z)).filter(z => specialGet(z, dipPosBlock) === dipDivider)
  //     // console.log(dipsInDivider)

  //     scoringFn = pos => {
  //       packout = pos.planogramProduct.calculatedFields.capacity / (Number.isNaN(pos.product.data.value.get(6)) ? 1 : (pos.product.data.value.get(6) === 0 ? 1 : pos.product.data.value.get(6)))
  //       numberOfpositions = pos.planogramProduct.positionsCount
  //       facings = pos.planogramProduct.calculatedFields.facings
  //       dos = pos.product.data.performanceValue.get(1) > 0 ? ((pos.planogramProduct.calculatedFields.capacity / pos.product.data.performanceValue.get(1)) * 7) : (15 * (facings / numberOfpositions))
  //       prevfacings = (Number.isNaN(parseFloat(pos.product.data.performanceDesc.get(50))) ? 1 : parseFloat(pos.product.data.performanceDesc.get(50)))
  //       return (packout >= 1.5 ? 9 : 0) + (dos > 7 ? 3 : 0) + (dos > 5 ? 2 : 0) + (dos > 3 ? 1.5 : 0) + (dos > 2 ? 1 : 0) + Math.min(150, (((facings + numberOfpositions) / facings) * dos)) +  /* (((facings /* / numberOfpositions ) > 15 ? 2 : 1) * (facings /* / numberOfpositions )) + */ ((facings - prevfacings) * ((facings - prevfacings) > 0 ? 2 : .5)) + (parseFloat(pos.product.upc) / 50000000000000) + (parseFloat(pos.transform.worldPos.x) / 50000)
  //     }

  //     scoring = pos => cached(mapS, pos, scoringFn)



  //     mapDipEx1 = new Map()
  //     mapDipEx2 = new Map()
  //     mapDipEx3 = new Map()
  //     mapS = new Map()

  //     clearCache = (...args) => args.forEach((arg) => arg.clear())
  //     clearDipCache = () => clearCache(mapDipEx1, mapDipEx2, mapDipEx3, mapS)

  //     pog.updateNodes()

  //     conditionDipEx1functionFn = posit => (round2dp(posit.merchSize.x, 6) < (round2dp(posit.fixture.calculatedFields.combinedLinear, 6) - round2dp(posits.filter(z => z.fixture.fixtureLeftMost.uuid === posit.fixture.fixtureLeftMost.uuid).reduce((total, z) => total + z.merchSize.x * z.facings.x, 0), 6)))
  //     conditionDipEx1function = posit => cached(mapDipEx1, posit, conditionDipEx1functionFn)

  //     conditionDipEx2functionFn = posit => (round2dp(maxXDivider, 6) - round2dp(minXDivider, 6)) >= (round2dp(posit.merchSize.x, 6) + round2dp(dipsInDivider.reduce((total, p) => {
  //       return total += p.merchSize.x * p.facings.x
  //     }, 0)))
  //     conditionDipEx2function = posit => cached(mapDipEx2, posit, conditionDipEx2functionFn)

  //     conditionDipEx3functionFn = posit => scoring(posit) === (dipsInDivider
  //       .filter(z => conditionDipEx1function(z) && conditionDipEx2function(z))
  //       .reduce((total, z) => {
  //         pscore = scoring(z)
  //         return total < pscore ? total : pscore
  //       }, Infinity))
  //     conditionDipEx3function = posit => cached(mapDipEx3, posit, conditionDipEx3functionFn)

  //     satisfiesDipExpansionCondition = posit => {
  //       return conditionDipEx1function(posit) && conditionDipEx2function(posit) && conditionDipEx3function(posit)
  //     }




  //     // balancing while loop
  //     console.log("Dip Balancing step...")

  //     while (true) {
  //       clearDipCache()
  //       dipsSatisfyingCondition = targetDoc.data.planogram.positions.filter(z => leavePosAlone(z)).filter(z => specialGet(z, dipPosBlock) === dipDivider).filter(satisfiesDipExpansionCondition).sort((a, b) => scoring(a) - scoring(b));
  //       if (dipsSatisfyingCondition.length === 0) break
  //       oneperFix = dipsSatisfyingCondition.reduce((total, z) => {
  //         if (!total.some(item => z.fixture.fixtureLeftMost.uuid === item.fixture.fixtureLeftMost.uuid)) {
  //           total.push(z)
  //         }
  //         return total
  //       }, [])
  //       for (let pos of oneperFix) {
  //         pos.facings.x += 1
  //         // console.log(pos.facings.x)
  //         clearDipCache()
  //         sleep(0)

  //       }
  //       await sleep(0)

  //     }
  //     // expansion for loop


  //   }



  // }


  // await sleep(5)
  // await dipInitialExpansion()
  // await sleep(10)

  // function dipDividerRemoval() {
  //   dividers = pog.fixtures.filter(f => f.name === "dip divider")
  //   positss = pog.positions.filter(z => leavePosAlone(z))
  //   for (let div of dividers) {
  //     div.parent = null
  //   }
  //   for (let pos of positss) {
  //     pos.merch.x.placement.value = 3
  //   }

  // }

  // dipDividerRemoval()
  // await sleep(10)

  // pog.updateNodes()


  // function layoutDips() {
  //   for (let fix of dipFixtures) {
  //     fix.layoutByRank()
  //   }
  // }

  // await sleep(10)
  // layoutDips()
  // await sleep(10)

  //#endregion


  async function dipFinalExpansion() {
    finalDipSet = targetDoc.data.planogram.positions.filter(z => leavePosAlone(z))
    // console.log(finalDipSet)

    scoringFn = pos => {
      packout = pos.planogramProduct.calculatedFields.capacity / (Number.isNaN(pos.product.data.value.get(6)) ? 1 : (pos.product.data.value.get(6) === 0 ? 1 : pos.product.data.value.get(6)))
      numberOfpositions = pos.planogramProduct.positionsCount
      facings = pos.planogramProduct.calculatedFields.facings
      dos = pos.product.data.performanceValue.get(1) > 0 ? ((pos.planogramProduct.calculatedFields.capacity / pos.product.data.performanceValue.get(1)) * 7) : (15 * (facings / numberOfpositions))
      prevfacings = (Number.isNaN(parseFloat(pos.product.data.performanceDesc.get(50))) ? 1 : parseFloat(pos.product.data.performanceDesc.get(50)))
      return (packout >= 1.5 ? 9 : 0) + (dos > 7 ? 3 : 0) + (dos > 5 ? 2 : 0) + (dos > 3 ? 1.5 : 0) + (dos > 2 ? 1 : 0) + Math.min(150, (((facings + numberOfpositions) / facings) * dos)) +  /* (((facings /* / numberOfpositions ) > 15 ? 2 : 1) * (facings /* / numberOfpositions )) + */ ((facings - prevfacings) * ((facings - prevfacings) > 0 ? 2 : .5)) + (parseFloat(pos.product.upc) / 50000000000000) + (parseFloat(pos.transform.worldPos.x) / 50000)
    }

    scoring = pos => cached(mapS2, pos, scoringFn)



    mapDipEx4 = new Map()
    mapDipEx5 = new Map()
    mapS2 = new Map()

    clearCache = (...args) => args.forEach((arg) => arg.clear())
    clearDipCache2 = () => clearCache(mapDipEx4, mapDipEx5, mapS2)

    pog.updateNodes()

    conditionDipEx4functionFn = posit => (round2dp(posit.merchSize.x, 6) < (round2dp(posit.fixture.calculatedFields.combinedLinear, 6) - round2dp(posits.filter(z => z.fixture.fixtureLeftMost.uuid === posit.fixture.fixtureLeftMost.uuid).reduce((total, z) => total + z.merchSize.x * z.facings.x, 0), 6)))
    conditionDipEx4function = posit => cached(mapDipEx4, posit, conditionDipEx4functionFn)

    conditionDipEx5functionFn = posit => scoring(posit) === (finalDipSet
      .filter(z => conditionDipEx4function(z))
      .reduce((total, z) => {
        pscore = scoring(z)
        return total < pscore ? total : pscore
      }, Infinity))
    conditionDipEx5function = posit => cached(mapDipEx5, posit, conditionDipEx5functionFn)

    satisfiesDipFinalExpansionCondition = posit => {
      return conditionDipEx4function(posit) && conditionDipEx5function(posit)
    }





    // // balancing while loop
    console.log("Dip Expansion step...")

    while (true) {
      clearDipCache2()
      dipsSatisfyingConditions = targetDoc.data.planogram.positions.filter(z => leavePosAlone(z)).filter(satisfiesDipFinalExpansionCondition).sort((a, b) => scoring(a) - scoring(b));
      if (dipsSatisfyingConditions.length === 0) { break }
      else {
        dipsSatisfyingConditions.at(0).facings.x += 1
        clearDipCache2()
        sleep(0)
      }
      await sleep(0)



    }
    // expansion for loop


  }


  await sleep(150)
  await dipFinalExpansion()
  await sleep(10)



  function dipFinalMerchSettings() {
    for (let dip of dips) {
      dip.merch.x.size.value = 2
    }
  }

  dipFinalMerchSettings()
  await sleep(25)




}

//#endregion

//#region TIDY

async function untidy(targetDoc) {
  proj = targetDoc.data
  pog = proj.planogram

  // get posits (positions that we want to optimise)
  posits = pog.positions//.filter(z => !leavePosAlone(z))

  function finalMerchSettings() {
    for (let pos of posits) {
      // if (pos.product.data.performanceDesc.get(37) === "MULTI" || pos.product.data.performanceDesc.get(37) === "MULTIPACK" || pos.product.data.performanceDesc.get(37) === " MULTIPACK") {
      //   pos.merchStyle = 0
      // } else {
      //   pos.merchStyle = 0
      // }
      pos.merch.x.size.value = 1
      pos.merch.y.placement.value = 2
      pos.merch.z.placement.value = 2
    }
  }

  finalMerchSettings()
  await sleep(0)
}

async function tidy(targetDoc) {
  proj = targetDoc.data
  pog = proj.planogram
  fixs = pog.fixtures

  // function removeBottomDividers() {
  //   for (let fix of fixs.filter(f => f.transform.worldPos.y < .254 && f.width < .1)) {
  //     fix.parent = null
  //   }
  // }

  // removeBottomDividers()
  // await sleep(25)

  // get posits (positions that we want to optimise)
  posits = pog.positions

  function finalMerchSettings() {
    for (let pos of posits) {
      // pos.merchStyle = 0
      // if (pos.product.data.performanceDesc.get(37) === "MULTI" || pos.product.data.performanceDesc.get(37) === "MULTIPACK" || pos.product.data.performanceDesc.get(37) === " MULTIPACK") {
      //   pos.merch.x.size.value = 1
      // } else {
      //   pos.merch.x.size.value = 1
      // }
      pos.merch.y.placement.value = 2
      pos.merch.z.placement.value = 2
    }
  }

  finalMerchSettings()
  await sleep(0)

  function partySizeDipReset() {
    for (let pos of posits) {
      if (pos.product.data.performanceDesc.get(38).includes("PARTY")) {
        pos.facings.x = 1
      }
    }
  }

  partySizeDipReset()
  await sleep(50)

  pog.merch.z.placement.value = 2
  pog.merch.y.placement.value = 2

  async function overAllocatedCheck() {
    pog.data.desc.set(50, "")
    for (let fix of pog.fixtures) {
      if (((pog.data.desc.get(50) != "OVER-ALLOCATED")) && (round2dp(fix.calculatedFields.combinedAvailableLinear, 6) < 0)) {
        1
        pog.data.desc.set(50, "OVER-ALLOCATED")

      }

    }
    await sleep(10)
  }

  overAllocatedCheck()
  await sleep(5)
}

//#endregion


//#region UI

var cssStyle = ``;

var body = `
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Planogram Optimizer</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            height: 100vh;
            margin: 0;
            font-size: 14px;
            padding: 10px
        }
        #validationResult {
            width: 100%;
            max-width: 960px;
            padding: 20px;
            background-color: #f8f8f8;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            text-align: left;
            margin-bottom: 20px; /* Added margin-bottom for spacing */
        }
        .buttons {
            display: flex;
            justify-content: center;
            gap: 20px;
        }
        .button {
            cursor: pointer;
            font-size: 16px;
            color: white;
            background-color: #007BFF;
            border: none;
            padding: 10px 20px;
            text-align: center;
            border-radius: 5px; /* Rounded corners for buttons */
            box-shadow: 2px 2px 10px rgba(0,0,0,0.2); /* subtle shadow for depth */
        }
        .clickable {
            cursor: pointer;
        }
    </style>
</head>
<body>
  <div id="validationResult"></div>
  <div class="buttons">
      <button id="refreshButton" class="button">Refresh</button>
      <button id="resetHighlightButton" class="button">Reset Highlight</button>
  </div>
</body>
`

var script = `
<script>
  function applySettings() {
    let DOS = document.getElementById("DOS").value;
    let COS = document.getElementById("COS").value;

    let message = {
      type: "run",
      settings: {
        dos: DOS,
        cos: COS,
      },
    };
    window.parent.postMessage(message, "*");
  }

  function addBlockers() {
    let message = {
      type: "blocking",
    };
    window.parent.postMessage(message, "*");
  }

  function receiveMessage(event) {
    const res = JSON.parse(event.data);
    const data = res.data;
    const variables = res.variables;
    switch (res.type) {
      case 'createResults':
        resultSummary(data, variables);
        break;
    }
  }

  function resultSummary(data, variables) {
    const message = '<strong>Bagged Snacks Optimiser</strong>' + '<br>' + '<br>' +
        '<strong>File:</strong> ' + data.filename + '<br>' +
        '<strong>Name:</strong> ' + data.name + '<br>' +
        '<strong>Store:</strong> ' + data.store + '<br>' + '<br>' +
        '<strong>Products:</strong><ul>' +
        '<li>Total: ' + data.productCount + '</li>' +
        '<li>Used: ' + data.productsUsed + '</li>' +
        '<li>Unused: ' + data.productsUnused + '</li></ul>' +
        '<strong>User Overrides</strong>' + 
        '<ol>' +
            '<li>Flex Space (in) <input id="flexspace" onchange="updateVariable(\'flexspace\')" type="number" min="0" value="' + variables.flexspace + '"></li>' +
        '</ol>' +
        '<strong class="clickable" onclick="runStep(\'all\')">Steps: (run all)</strong>' + 
        '<ol>' +
            '<li class="clickable" onclick="runStep(\'load Template\')">Load Template</li>' +
            '<li class="clickable" onclick="runStep(\'prepare\')">Prepare</li>' +
            '<ul>' +
                '<li>New Placed <span class="clickable" onclick="highlight(\'new\')">(H)</span> <span class="clickable" onclick="label(\'new\')">(L)</span></li>' +
                '<li>Desc 35(Block) <span class="clickable" onclick="highlight(\'desc35\')">(H)</span> <span class="clickable" onclick="label(\'desc35\')">(L)</span></li>' +
                '<li>Desc 36(Competitive Space) <span class="clickable" onclick="highlight(\'desc36\')">(H)</span> <span class="clickable" onclick="label(\'desc36\')">(L)</span></li>' +
                '<li>Desc 37(Divider Blocks) <span class="clickable" onclick="highlight(\'desc37\')">(H)</span> <span class="clickable" onclick="label(\'desc37\')">(L)</span></li>' +
                '<li>Desc 39(Revisited Blocks) <span class="clickable" onclick="highlight(\'desc39\')">(H)</span> <span class="clickable" onclick="label(\'desc39\')">(L)</span></li>' +
                '<li>Alt = Squeeze <span class="clickable" onclick="highlight(\'dims\')">(H)</span> <span class="clickable" onclick="label(\'dims\')">(L)</span></li>' +
            '</ul>' + 
            '<li class="clickable" onclick="runStep(\'optimise\')">Optimize</li>' +
            '<ul>' +
                '<li>Conditions</li>' +
                '<ul>' +
                    '<li class="clickable" onclick="highlightCondition(\'A\')">Space Available(A)</li>' +
                    '<li class="clickable" onclick="highlightCondition(\'B\')">Blocking Balanced(B)</li>' +
                    '<li class="clickable" onclick="highlightCondition(\'C\')">Best in Blocking(C)</li>' +
                    '<li class="clickable" onclick="highlightCondition(\'D\')">All Shelves Check(D)</li>' +
                    '<li class="clickable" onclick="highlightCondition(\'E\')">Best Expansion Item(E)</li>' +
                    '<li class="clickable" onclick="highlightCondition(\'F\')">Best Block Expansion(F)</li>' +
                    '<li class="clickable" onclick="highlightCondition(\'G\')">Overall Space Check(G)</li>' +
                    '<li class="clickable" onclick="highlightCondition(\'Balancing\')">Balancing</li>' +
                    '<li class="clickable" onclick="highlightCondition(\'Expansion\')">Expansion</li>' +
                    '<li class="clickable" onclick="highlightCondition(\'Score\')">Score</li>' +
                '</ul>' + 
                '<li>Controls</li>' +
                '<ul>' +
                    '<li class="clickable" onclick="optimiseAction(\'start\')">Start</li>' +
                    '<li class="clickable" onclick="optimiseAction(\'stop\')">Stop</li>' +
                    '<li class="clickable" onclick="optimiseAction(\'next\')">Next</li>' +
                    '<li class="clickable" onclick="optimiseAction(\'clearCache\')">Clear Cache</li>' +
                '</ul>' + 
            '</ul>' + 
            '<li class="clickable" onclick="runStep(\'blocking\')">Blocking</li>' +
            '<ul>' +
                '<li class="clickable" onclick="highlight(\'blockingfails\')">Failures</li>' +
                '<li class="clickable" onclick="highlight(\'blockingwidth\')">Total Width</li>' +
            '</ul>' + 
            '<li class="clickable" onclick="runStep(\'reoptimise\')">reOptimize</li>' +
            '<ul>' +
                '<li class="clickable" onclick="runStep(\'reoptimisePrepare\')">Prepare</li>' +
                '<li>Conditions</li>' +
                '<ul>' +
                    '<li class="clickable" onclick="highlightCondition2(\'I\')">Space Available(I)</li>' +
                    '<li class="clickable" onclick="highlightCondition2(\'J\')">Blocking Balanced(J)</li>' +
                    '<li class="clickable" onclick="highlightCondition2(\'K\')">Best in Blocking(K)</li>' +
                    '<li class="clickable" onclick="highlightCondition2(\'L\')">All Shelves Check(L)</li>' +
                    '<li class="clickable" onclick="highlightCondition2(\'N\')">Best Expansion Item(N)</li>' +
                    '<li class="clickable" onclick="highlightCondition2(\'M\')">Best Block Expansion(M)</li>' +
                    '<li class="clickable" onclick="highlightCondition2(\'Balancing\')">Balancing</li>' +
                    '<li class="clickable" onclick="highlightCondition2(\'Expansion\')">Expansion</li>' +
                    '<li class="clickable" onclick="highlightCondition2(\'Score\')">Score</li>' +
                '</ul>' + 
                '<li>Controls</li>' +
                '<ul>' +
                    '<li class="clickable" onclick="reoptimiseAction(\'start\')">Start</li>' +
                    '<li class="clickable" onclick="reoptimiseAction(\'stop\')">Stop</li>' +
                    '<li class="clickable" onclick="reoptimiseAction(\'next\')">Next</li>' +
                    '<li class="clickable" onclick="reoptimiseAction(\'clearCache\')">Clear Cache</li>' +
                '</ul>' + 
            '</ul>' + 
            '<li class="clickable" onclick="runStep(\'subPlanogramPrepare\')">sub-Planogram Prepare</li>' +
            '<li class="clickable" onclick="runStep(\'tidy\')">Tidy</li>' +
        '</ol>' +
        '<strong>Other validations:</strong>' + 
        '<ol>' +
            '<li>DOS <span class="clickable" onclick="highlight(\'dos\')">(H)</span> <span class="clickable" onclick="label(\'dos\')">(L)</span></li>' +
            '<li>Packout <span class="clickable" onclick="highlight(\'packout\')">(H)</span> <span class="clickable" onclick="label(\'packout\')">(L)</span></li>' +
            '<li>Prev-facings <span class="clickable" onclick="highlight(\'prevfacings\')">(H)</span> <span class="clickable" onclick="label(\'prevfacings\')">(L)</span></li>' +
            '<li>Facings mismatch <span class="clickable" onclick="highlight(\'facingsmatch\')">(H)</span></li>'
        '</ol>';

    document.getElementById('validationResult').innerHTML = message;
  }

  function runStep(step) {
    window.parent.postMessage({ type: "run", step: step }, "*");
  }

  function optimiseAction(step) {
    window.parent.postMessage({ type: "optimiseAction", step: step }, "*");
  }

    function reoptimiseAction(step) {
    window.parent.postMessage({ type: "reoptimiseAction", step: step }, "*");
  }

  function highlight(key) {
      window.parent.postMessage({ type: "highlight", key }, "*");
  }

  function label(key) {
      window.parent.postMessage({ type: "label", key }, "*");
  }

  function highlightCondition(key) {
    window.parent.postMessage({ type: "condition", key }, "*");
  }

 function highlightCondition2(key) {
    window.parent.postMessage({ type: "condition2", key }, "*");
  }

  function highlightDetail(key) {
      window.parent.postMessage({ type: "highlight", key }, "*");
  }

  function updateVariable(key) {
      value = document.getElementById(key).value
      window.parent.postMessage({ type: "update variable", key, value }, "*");
  }

  document.getElementById('refreshButton').addEventListener('click', function() {
      window.parent.postMessage({ type: "getData" }, "*");
  });

  document.getElementById('resetHighlightButton').addEventListener('click', function() {
      window.parent.postMessage({ type: "highlight", key: "reset"  }, "*");
      window.parent.postMessage({ type: "label", key: "reset"  }, "*");
  });

  window.parent.postMessage({ type: "getData" }, "*");
</script>
`;

  //endregionnn