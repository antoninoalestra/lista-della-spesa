import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Configuration of chains to scrape from DoveConviene
const TARGET_CHAINS = [
  { slug: 'conad', name: 'Conad', dc: 'conad' },
  { slug: 'conad-superstore', name: 'Conad Superstore', dc: 'conad-superstore' },
  { slug: 'conad-city', name: 'Conad City', dc: 'conad-city' },
  { slug: 'coop', name: 'Coop', dc: 'coop' },
  { slug: 'ipercoop', name: 'Ipercoop', dc: 'ipercoop' },
  { slug: 'carrefour-express', name: 'Carrefour Express', dc: 'carrefour-express' },
  { slug: 'carrefour-market', name: 'Carrefour Market', dc: 'carrefour-market' },
  { slug: 'carrefour-ipermercati', name: 'Carrefour Iper', dc: 'carrefour-ipermercati' },
  { slug: 'lidl', name: 'Lidl', dc: 'lidl' },
  { slug: 'eurospin', name: 'Eurospin', dc: 'eurospin' },
  { slug: 'penny', name: 'Penny', dc: 'penny' },
  { slug: 'todis', name: 'Todis', dc: 'todis' },
  { slug: 'md', name: 'MD', dc: 'md' },
  { slug: 'esselunga', name: 'Esselunga', dc: 'esselunga' },
  { slug: 'tigre', name: 'Tigre', dc: 'tigre' },
  { slug: 'dem', name: 'Dem', dc: 'dem' },
  { slug: 'elite', name: 'Elite', dc: 'elite-supermercati' },
  { slug: 'pewex', name: 'Pewex', dc: 'pewex' },
];

const CATEGORY_KEYWORDS = {
  ortofrutta: ['mela', 'mele', 'pera', 'pere', 'banana', 'banane', 'arance', 'limon', 'pomodor', 'insalat', 'patat', 'carot', 'zucchine', 'verdura', 'frutta'],
  latticini: ['latte', 'formagg', 'mozzarell', 'parmigian', 'grana', 'ricotta', 'burro', 'yogurt', 'uova', 'uovo', 'stracchin', 'gorgonzola', 'provola'],
  carne: ['pollo', 'tacchin', 'manzo', 'suino', 'maiale', 'vitello', 'salsicci', 'prosciutt', 'salame', 'mortadell', 'bacon', 'wurstel', 'carne'],
  pesce: ['salmone', 'tonno', 'orata', 'spigola', 'merluzzo', 'gamber', 'pesce', 'calamar', 'polpo', 'cozze', 'vongole'],
  surgelati: ['surgelat', 'gelat', 'pizze surgelate', 'bastoncini', 'piselli surgelati'],
  bevande: ['acqua', 'coca', 'pepsi', 'fanta', 'birra', 'vino', 'succo', 'aranciata', 'the', 'thé', 'caffè', 'bibita', 'detersivo', 'shampoo', 'sapone', 'carta igienica'],
};

function categorize(name) {
  const lower = name.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return cat;
  }
  return 'dispensa';
}

function hashId(str) {
  return crypto.createHash('md5').update(str).digest('hex').slice(0, 12);
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'it-IT,it;q=0.9',
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

async function scrapeChainFlyers(chain) {
  console.log(`[Scraper] Cerco volantini per ${chain.name} (${chain.dc})...`);
  const chainUrl = `https://www.doveconviene.it/roma/volantino/${chain.dc}`;
  let html;
  try {
    html = await fetchWithRetry(chainUrl);
  } catch (err) {
    console.warn(`[Scraper] Impossibile raggiungere ${chainUrl}: ${err.message}`);
    return [];
  }

  // Extract flyers from JSON-LD OfferCatalog
  const flyers = [];
  const jsonLdMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  for (const raw of jsonLdMatches) {
    try {
      const obj = JSON.parse(raw);
      if (obj['@type'] === 'OfferCatalog' && Array.isArray(obj.itemListElement)) {
        for (const item of obj.itemListElement) {
          if (item.url && (item['@type'] === 'SaleEvent' || item.name)) {
            let flyerUrl = item.url;
            if (flyerUrl.startsWith('/')) flyerUrl = 'https://www.doveconviene.it' + flyerUrl;
            const flyerIdMatch = flyerUrl.match(/flyerId=(\d+)/);
            flyers.push({
              id: flyerIdMatch ? flyerIdMatch[1] : hashId(flyerUrl),
              title: item.name || 'Volantino ' + chain.name,
              validFrom: item.startDate || new Date().toISOString().slice(0, 10),
              validTo: item.endDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
              url: flyerUrl,
            });
          }
        }
      }
    } catch (_) {}
  }

  // Deduplicate flyers by ID
  const uniqueFlyers = [];
  const seenIds = new Set();
  for (const f of flyers) {
    if (!seenIds.has(f.id)) {
      seenIds.add(f.id);
      uniqueFlyers.push(f);
    }
  }

  console.log(`[Scraper] Trovati ${uniqueFlyers.length} volantini per ${chain.name}`);
  return uniqueFlyers.slice(0, 3); // Max 3 most recent flyers per chain
}

async function scrapeFlyerProducts(chain, flyer) {
  console.log(`  -> Scarico prodotti volantino "${flyer.title}" (id: ${flyer.id})...`);
  let html;
  try {
    html = await fetchWithRetry(flyer.url);
  } catch (err) {
    console.warn(`  -> Errore volantino ${flyer.url}: ${err.message}`);
    return [];
  }

  const products = [];
  const jsonLdMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  for (const raw of jsonLdMatches) {
    try {
      const obj = JSON.parse(raw);
      if (obj['@type'] === 'Product' && obj.name && obj.offers) {
        const rawPrice = obj.offers.price || obj.offers.lowPrice;
        const price = parseFloat(String(rawPrice).replace(',', '.'));
        if (isNaN(price) || price <= 0) continue;

        const name = obj.name.trim();
        const brandMatch = name.match(/^([A-Za-z0-9àèéìòùÀÈÉÌÒÙ'\s]+)\s*-\s*(.+)$/);
        const cleanName = brandMatch ? brandMatch[2].trim() : name;
        const brand = brandMatch ? brandMatch[1].trim() : null;

        products.push({
          id: hashId(`${chain.slug}:${flyer.id}:${name}:${price}`),
          source: 'doveconviene',
          chain: chain.slug,
          chainName: chain.name,
          flyerId: flyer.id,
          flyerTitle: flyer.title,
          validFrom: flyer.validFrom,
          validTo: flyer.validTo,
          name: cleanName,
          brand: brand,
          rawName: name,
          price: price,
          qty: null,
          unitPrice: null,
          unitPriceSource: null,
          originalPrice: null,
          discountPct: null,
          foodName: null,
          matchConfidence: 0,
          category: categorize(cleanName),
          kind: 'food',
          ai: 'none',
        });
      }
    } catch (_) {}
  }

  console.log(`  -> Estratti ${products.length} prodotti da "${flyer.title}"`);
  return products;
}

export async function runScraper(options = {}) {
  const startTime = Date.now();
  console.log('=== AVVIO SCRAPING OFFERTE VOLANTINI ===');
  console.log('Data:', new Date().toISOString());

  const allOffers = [];
  const chainsMeta = [];

  for (const chain of TARGET_CHAINS) {
    try {
      const flyers = await scrapeChainFlyers(chain);
      const chainFlyersMeta = [];

      for (const flyer of flyers) {
        const products = await scrapeFlyerProducts(chain, flyer);
        if (products.length > 0) {
          allOffers.push(...products);
          chainFlyersMeta.push({
            id: flyer.id,
            title: flyer.title,
            validFrom: flyer.validFrom,
            validTo: flyer.validTo,
            url: flyer.url,
            products: products.length,
          });
        }
        // Small delay to be polite
        await new Promise(r => setTimeout(r, 300));
      }

      if (chainFlyersMeta.length > 0) {
        chainsMeta.push({
          slug: chain.slug,
          name: chain.name,
          flyers: chainFlyersMeta,
        });
      }
    } catch (err) {
      console.warn(`[Scraper] Errore su catena ${chain.name}:`, err.message);
    }
  }

  console.log(`\n=== RIEPILOGO SCRAPING ===`);
  console.log(`Totale offerte estratte: ${allOffers.length}`);
  console.log(`Catene coperte: ${chainsMeta.length}`);
  console.log(`Tempo impiegato: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  if (allOffers.length === 0) {
    console.warn('ATTENZIONE: Nessuna offerta trovata! Non sovrascrivo i dati esistenti.');
    return;
  }

  // Deduplicate offers by chain and name
  const seenOffers = new Set();
  const dedupedOffers = [];
  for (const o of allOffers) {
    const key = `${o.chain}:${o.name.toLowerCase()}:${o.price}`;
    if (!seenOffers.has(key)) {
      seenOffers.add(key);
      dedupedOffers.push(o);
    }
  }

  const updatedOffersData = {
    roma: {
      schema: 1,
      city: 'roma',
      cityName: 'Italia',
      source: { name: 'DoveConviene', url: 'https://www.doveconviene.it/roma' },
      contentHash: hashId(JSON.stringify(dedupedOffers)),
      updatedAt: new Date().toISOString(),
      chains: chainsMeta,
      offers: dedupedOffers,
    }
  };

  // Update app.js
  const appJsPath = path.resolve('app.js');
  if (fs.existsSync(appJsPath)) {
    console.log(`Aggiorno dati offerte in ${appJsPath}...`);
    let appContent = fs.readFileSync(appJsPath, 'utf8');
    const startIdx = appContent.indexOf('const OFFERS_DATA =');
    if (startIdx !== -1) {
      const newOffersDeclaration = `const OFFERS_DATA = ${JSON.stringify(updatedOffersData)};\n`;
      appContent = appContent.slice(0, startIdx) + newOffersDeclaration;
      fs.writeFileSync(appJsPath, appContent, 'utf8');
      console.log('app.js aggiornato con successo!');
    } else {
      console.error('const OFFERS_DATA non trovato in app.js!');
    }
  }

  console.log('=== SCRAPING COMPLETATO CON SUCCESSO ===');
}

// If executed directly:
if (process.argv[1] && process.argv[1].endsWith('update-offers.mjs')) {
  runScraper().catch(err => {
    console.error('Fatal error in scraper:', err);
    process.exit(1);
  });
}
