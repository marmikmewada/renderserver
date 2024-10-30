const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const scrapeLinks = async () => {
    console.log('Starting the link scraping process...');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const results = []; // Array to hold the results

    try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        await page.goto('https://themoviesflix.beer/');

        // Step 1: Extract all <a> tags from the main page
        const links = await page.$$eval('body a', elements => elements.map(el => el.href).filter(href => href));
        const categoryLinks = links.filter(link => link.includes('/category/'));

        // Visit each category link
        for (const categoryLink of categoryLinks) {
            await page.goto(categoryLink);

            // Extract all <a> tags from the category page
            const categoryPageLinks = await page.$$eval('body a', elements => elements.map(el => el.href).filter(href => href));
            const filteredLinks = categoryPageLinks.filter(link => link.includes('.beer/'));

            // Visit each relevant child link and extract data
            for (const childLink of filteredLinks) {
                await page.goto(childLink);

                try {
                    // Extract the movie title from the <h1> tag
                    const title = await page.$eval('h1.title.single-title.entry-title', el => el.innerText);
                    // Extract the image source from the <img> tag
                    const imgSrc = await page.$eval('img.aligncenter', el => el.src);
                    // Extract relevant <a> tags
                    const relevantLinks = await page.$$eval('a.wo', elements => elements.map(el => ({
                        text: el.innerText,
                        href: el.href
                    })));

                    // Push structured output to results
                    results.push({
                        parentLink: categoryLink,
                        childLink,
                        title,
                        imgSrc,
                        relevantLinks
                    });

                    // Log the structured output
                    console.log(`\nParent Category: ${categoryLink}`);
                    console.log(`- Child Link: ${childLink}`);
                    console.log(`  Movie Title: ${title}`);
                    console.log(`  Image Source: ${imgSrc}`);
                    console.log(`  Found ${relevantLinks.length} relevant links on this child page:\n`);
                    relevantLinks.forEach(link => {
                        console.log(`    - ${link.text}: ${link.href}`);
                    });
                } catch (error) {
                    console.error(`Error extracting data from ${childLink}: ${error.message}`);
                }
            }
        }

        // Clear old data and save new results
        const filePath = path.join(process.cwd(), 'data', 'scrapedData.json');
        fs.writeFileSync(filePath, JSON.stringify(results, null, 2)); // Overwrite the file
        console.log('Scraped data saved to scrapedData.json');
    } catch (error) {
        console.error(`Error fetching the page: ${error.message}`);
    } finally {
        await browser.close();
        console.log('Browser closed. Process finished.');
    }
};

// Define the /scrapedata route
app.get('/scrapedata', async (req, res) => {
    try {
        await scrapeLinks();
        res.json({ message: 'Scraping completed successfully!' });
    } catch (error) {
        console.error('Scraping error:', error);
        res.status(500).json({ message: 'Scraping failed', error: error.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
