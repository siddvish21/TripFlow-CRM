
import { QuotationData, PaymentBankDetails } from '../types';

export const generateQuotationHtml = (data: QuotationData, paymentDetails: PaymentBankDetails): string => {
    const {
        customerName,
        destination,
        duration,
        dates,
        mealPlan,
        vehicle,
        itineraryTitle,
        itinerary,
        hotels,
        hotelOptions,
        inclusions,
        exclusions,
        totalAmount,
        amountReceived,
        balanceAmount,
        destinationImage,
        hotelCategory,
        financialBreakdown,
        costDetails,
        paxCount,
        marginPercentage,
        isDomestic,
        adultsCount,
        childrenCount,
        childAges
    } = data;

    // --- Helper: Financial Calculations (Mirrors App.tsx/docxGenerator.ts) ---
    const calculateFinancials = () => {
        if (financialBreakdown && Array.isArray(financialBreakdown.options) && financialBreakdown.options.length > 0) {
            return financialBreakdown.options.map(opt => {
                const netCostPerPerson = opt.extractedNetCost || (opt.landBaseCost + opt.landGST + opt.landTCS);
                return {
                    label: opt.label,
                    perPersonCost: Math.round(opt.landBaseCost),
                    gstAmount: Math.round(opt.landGST),
                    tcsAmount: Math.round(opt.landTCS),
                    netCostPerPerson: Math.round(netCostPerPerson),
                    addOnCost: Math.round(opt.addOnCost),
                    childCosts: opt.childCosts || []
                };
            });
        }

        // Fallback
        const perPersonCost = costDetails?.perPersonCost || 0;
        const gstPercentage = costDetails?.gstPercentage || 5;
        const marginAmount = perPersonCost * (marginPercentage / 100);
        const costWithMargin = perPersonCost + marginAmount;
        const gstAmount = costWithMargin * (gstPercentage / 100);
        const tcsPercentage = isDomestic ? 0 : (costDetails?.tcsPercentage || 5);
        const tcsAmount = (costWithMargin + gstAmount) * (tcsPercentage / 100);
        const netCostPerPerson = costWithMargin + gstAmount + tcsAmount;

        return [{
            label: "Option 1",
            perPersonCost: Math.round(perPersonCost),
            gstAmount: Math.round(gstAmount),
            tcsAmount: Math.round(tcsAmount),
            netCostPerPerson: Math.round(netCostPerPerson),
            addOnCost: 0,
            childCosts: []
        }];
    };

    const financials = calculateFinancials();

    // --- Asset URLs ---
    const HEADER_IMG_URL = "https://res.cloudinary.com/dnauowwb0/image/upload/v1765680866/Trip-Explore-Banner_ejp9hh.png";
    const TOP_HEADER_IMG_URL = "https://res.cloudinary.com/dnauowwb0/image/upload/v1765683665/Gemini_Generated_Image_wniw9nwniw9nwniw_e0awo6.png";

    // --- HTML Construction ---
    return `
    <html>
    <head>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700&display=swap');
            
            body { 
                font-family: 'Lexend', sans-serif; 
                color: #333; 
                line-height: 1.5; 
                margin: 0;
                padding: 0;
            }
            .container { 
                max-width: 800px; 
                margin: 0 auto; 
                padding: 40px; 
                background: white;
            }
            
            /* Banner Sizes */
            .trip-explore-banner {
                width: 100%;
                height: auto;
                display: block;
                margin-bottom: 20px;
            }
            .top-header-banner {
                width: 6.65in; /* exact width in inches */
                height: 2.18in; /* exact height in inches */
                object-fit: cover;
                display: block;
                margin: 0 auto;
            }
            .hotel-rates-banner {
                width: 6.46in; /* exact width in inches */
                height: 2.11in; /* exact height in inches */
                object-fit: cover;
                display: block;
                margin: 0 auto;
            }
            .header-img { width: 100%; height: auto; display: block; margin-bottom: 20px; }
            .text-center { text-align: center; }
            
            /* Section Titles */
            .section-title { 
                color: #003366; 
                font-size: 26px; /* Increased from 24px */
                font-weight: 700; 
                border-bottom: 3px solid #00AEEF; 
                padding-bottom: 5px; 
                margin-top: 40px; 
                margin-bottom: 20px; 
            }

            /* Transparency Section (Problem/Solution) */
            .transparency-box { 
                padding: 15px 0; 
                margin-bottom: 15px; 
            }
            .problem-block {
                margin-bottom: 10px; 
            }
            .problem-title { color: #00AEEF; font-size: 28px; font-weight: 800; margin-bottom: 5px; } /* Increased from 26px */
            .reality-title { font-weight: 700; font-size: 20px; margin-top: 10px; color: #111; } /* Increased from 18px */
            .solution-text { color: #444; font-size: 18px; margin-bottom: 5px; } /* Increased from 16px */
            
            /* Separators */
            /* Lightweight separator for later sections (not used around banners/text) */
            .separator-line {
                border: none;
                border-top: 1px solid #e5e7eb;
                margin: 24px 0;
            }
            
            /* Itinerary Styling */
            .itinerary-heading-container {
                text-align: center;
                margin-top: 30px;
                margin-bottom: 20px;
                border-top: 2px solid #e5e7eb;
                padding-top: 10px;
            }
            .itinerary-main-title {
                font-size: 30px; /* Increased from 28px */
                font-weight: 800;
                color: #1f2937;
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            .day-container {
                margin-bottom: 30px;
            }
            
            .day-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 12px;
            }
            
            .day-icon {
                font-size: 24px; /* Calendar Icon Size */
            }

            .day-title-text {
                font-size: 22px; /* Increased from 20px */
                font-weight: 800;
                color: #0c4a6e; /* Dark Blue */
            }

            .itinerary-list { 
                list-style: none; 
                padding-left: 10px; 
                border-left: 3px solid #e5e7eb; 
                margin-left: 14px; /* Align with icon center approximately */
            }
            .itinerary-item { 
                position: relative; 
                padding-left: 25px; 
                margin-bottom: 12px; 
                font-size: 18px; /* Increased from 16px */
                color: #374151;
            }
            .itinerary-item::before { 
                content: "→"; 
                color: #3b82f6; /* Blue Arrow */
                font-size: 18px;
                position: absolute; 
                left: 0; 
                top: -2px;
            }

            /* Tables */
            table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 16px; } /* Increased from 14px */
            th, td { border: 1px solid #d1d5db; padding: 12px; text-align: left; }
            th { background-color: #f3f4f6; font-weight: 700; color: #111; }
            
            .rate-table th { background-color: #1f2937; color: white; text-align: center; font-weight: 600; letter-spacing: 0.5px; }
            .rate-table td { text-align: center; }

            /* Exclusions / Inclusions */
            .list-check li { padding-left: 5px; margin-bottom: 8px; }
            
            /* Bank Details */
            .bank-details { background-color: #f8fafc; padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0; }

            /* Smart Spacing Utilities */
            .mt-4 { margin-top: 1rem; }
            .mb-2 { margin-bottom: 0.5rem; }
        </style>
    </head>
    <body>
        <div class="container">
            <!-- 1. Top Poster (Trip Explore Standard) -->
            <!-- 1. Top Header Banner (Gemini image, fixed size) -->
            <img src="${TOP_HEADER_IMG_URL}" class="top-header-banner" alt="Top Banner" style="width: 6.65in; height: 2.18in; object-fit: cover; display: block; margin: 0 auto;" />
            
            <!-- 2. Hotel Rates Banner (Specific Size) -->
            <!-- Placeholder for Hotel Rates Banner if dynamic, otherwise using Header Img as proxy or new upload -->
            <img src="${HEADER_IMG_URL}" class="hotel-rates-banner" alt="Hotel Rates Banner" style="width: 6.46in; height: 2.11in; object-fit: cover; display: block; margin: 0 auto;" />
            
            <hr class="separator-line" />

            <!-- Collaboration Message -->
            <div class="text-center" style="margin: 15px 0;">
                <p style="font-size: 18px; color: #333; margin: 0; font-weight: bold; font-style: italic;">
                    🤝 In <span style="background-color: #ffff00; padding: 0 4px;">collaboration</span> with our trusted partners at TripExplore – crafting seamless travel experiences together.
                </p>
                <p style="font-size: 16px; color: #0000FF; margin: 10px 0 0 0;">
                    🔗 Know more about them at: <a href="https://www.tripexplore.in" style="color: #0000FF; text-decoration: underline;">www.tripexplore.in</a>
                </p>
            </div>

            <hr class="separator-line" />

            <!-- Transparency Section (Compact) -->
            <div class="transparency-box">
                <div class="problem-block">
                    <div class="problem-title">Problem 1</div>
                    <p class="solution-text">People think we only give tours with the hotels shown in our quote.</p>
                    <div class="reality-title">Reality</div>
                    <p class="solution-text">Nope! We can plan your trip with <b>any hotel you like</b> and add <b>any sightseeing</b> you want.</p>
                </div>
                
                <hr class="separator-line" style="margin: 20px 0;" /> <!-- Single line separator -->

                <div class="problem-block">
                    <div class="problem-title">Problem 2</div>
                    <p class="solution-text">People see one price (like Rs 50,000) and Book it.</p>
                    <div class="reality-title">Solution</div>
                    <p class="solution-text">Prices change because hotels/locations differ. Always check inclusions.</p>
                </div>
            </div>

            <div class="text-center" style="margin: 30px 0; font-size: 18px; color: #003366; font-weight: 700; font-style: italic;">
                "Let’s talk openly, like friends, and get the best deal."
            </div>

            <br style="page-break-before: always;">

            <!-- Quotation Cover -->
            ${destinationImage ? `
                <div style="position: relative; margin-bottom: 30px; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
                    <img src="data:image/png;base64,${destinationImage}" style="width: 100%; height: 350px; object-fit: cover;" />
                    <div style="position: absolute; bottom: 0; left: 0; width: 100%; background: linear-gradient(transparent, black); padding: 30px; box-sizing: border-box;">
                        <h1 style="color: white; margin: 0; font-size: 42px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">${itineraryTitle}</h1>
                    </div>
                </div>
            ` : ''}

            <div style="text-align: center; margin-bottom: 40px;">
                <h1 style="font-size: 28px; color: #333;">Quotation for <span style="color: #2563EB; text-decoration: underline; text-decoration-thickness: 3px;">${customerName}</span></h1>
            </div>

            <!-- Info Grid -->
            <div style="background-color: #f0f9ff; padding: 25px; border-radius: 12px; border: 1px solid #bae6fd; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px;">
                <div><b>👥 PAX:</b> ${adultsCount || 0} Adults + ${childrenCount || 0} Child ${childAges ? `(Age: ${childAges})` : ''}</div>
                <div><b>📍 Destination:</b> ${destination}</div>
                <div><b>⏳ Duration:</b> ${duration}</div>
                <div><b>🗓️ Dates:</b> ${dates}</div>
                <div><b>🍲 Meal Plan:</b> ${mealPlan}</div>
                <div><b>🚗 Vehicle:</b> ${vehicle}</div>
            </div>

            <!-- Itinerary Header -->
             <div class="itinerary-heading-container">
                <span class="itinerary-main-title">Detailed Itinerary</span>
            </div>

            <!-- Itinerary List -->
            <div style="margin-top: 20px;">
                ${itinerary.map(day => {
        const v = (vehicle || '').toLowerCase();
        const mode = v.includes('sic') ? 'Shared (SIC)' : (v.includes('private') ? 'Private' : undefined);
        const type = v.includes('sedan') ? 'Sedan' : v.includes('suv') ? 'SUV' : v.includes('tempo') ? 'Tempo Traveller' : v.includes('coach') ? 'Coach' : undefined;
        const title = (day.title || '').toLowerCase();
        const synthetic: string[] = [];
        if (/arrival/.test(title)) synthetic.push(`Arrival transfer (${mode || 'Private'} ${type || 'Sedan'}): Airport → Hotel`);
        if (/departure/.test(title)) synthetic.push(`Departure transfer (${mode || 'Private'} ${type || 'Sedan'}): Hotel → Airport`);
        if (/transfer/.test(title) && !/arrival|departure/.test(title)) {
            synthetic.push(`City transfer (${mode || 'Private'} ${type || 'Sedan'}): Hotel → City Center`);
            if ((day.points || []).some(p => /en[- ]?route|on the way|road/i.test(p))) {
                synthetic.push(`En-route sightseeing (30–45 min): key attractions`);
            }
        }
        if (/disposal/.test(title)) synthetic.push(`Vehicle disposal (${mode || 'Private'} ${type || 'Sedan'}) — duration 8h`);
        // Removed word limit to preserve full itinerary content
        let pts = [...synthetic, ...day.points.map(p => p.replace(/^[→•]\s*/, '').trim())];
        pts = pts.map(p => /ticket|entry|admission|pass/i.test(p) && !/ticket/i.test(p) ? `${p} — tickets included` : p);
        const fillers = [
            `${mode || 'Private'} ${type || 'Sedan'} city transfer`,
            `Guided city tour (SIC)`,
            `Optional en-route sightseeing (30–45 min)`
        ];
        while (pts.length < 2 && fillers.length) pts.push(fillers.shift()!);
        pts = pts.slice(0, 5);
        return `
                    <div class=\"day-container\"> 
                        <div class=\"day-header\"> 
                            <span class=\"day-icon\">📅</span>  
                            <span class=\"day-title-text\">Day ${day.day}: ${day.title}</span> 
                        </div> 
                        <ul class=\"itinerary-list\"> 
                            ${pts.map(p => `<li class=\"itinerary-item\">${p}</li>`).join('')} 
                        </ul> 
                    </div>`;
    }).join('')}
            </div>
            
            <hr class="separator-line" style="border-top: 2px dashed #ccc; margin: 40px 0;" />
            <br style="page-break-before: always;">

            <!-- Accommodations -->
            <h2 class="section-title">🏨 Your Stays</h2>
            ${(data.hotelOptions && data.hotelOptions.length > 0) ?
            data.hotelOptions.map(opt => `
                    <h3 style="color: #003366; margin-top: 20px;">${opt.optionLabel}</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Destination</th>
                                <th>Hotel</th>
                                <th>Room Category</th>
                                <th>Nights</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${opt.hotels.map(h => `
                                <tr>
                                    <td>${h.destination}</td>
                                    <td><b>${h.hotelName}</b></td>
                                    <td>${h.roomCategory}</td>
                                    <td style="text-align: center;">${h.nights}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `).join('')
            : (hotels && hotels.length > 0 ? `
                    <table>
                        <thead>
                            <tr>
                                <th>Destination</th>
                                <th>Hotel</th>
                                <th>Room Category</th>
                                <th>Nights</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${hotels.map(h => `
                                <tr>
                                    <td>${h.destination}</td>
                                    <td><b>${h.hotelName}</b></td>
                                    <td>${h.roomCategory}</td>
                                    <td style="text-align: center;">${h.nights}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '')
        }
            
            <hr class="separator-line" style="margin: 30px 0;" />

            <!-- Package Cost Summary -->
            ${financials && financials.length > 0 ? `
                <h3 class="section-title">💰 Package Cost Summary</h3>
                <div style="margin: 20px 0;">
                    ${financials.map((opt: any, i: number) => {
                        const costPerHead = opt.netCostPerPerson + opt.addOnCost;
                        const totalCostForPax = costPerHead * paxCount;
                        return `
                            <div style="background: #DBEAFE; border: 2px solid #93C5FD; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                                <h4 style="font-weight: bold; font-size: 18px; margin-bottom: 15px; text-align: center; color: #1E293B;">${opt.label || `Option ${i + 1}`}</h4>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 15px;">
                                    <div>
                                        <p style="color: #64748B; font-size: 14px; margin-bottom: 5px;">Cost Per Head</p>
                                        <p style="font-weight: bold; font-size: 20px; color: #1E40AF;">INR ${costPerHead.toLocaleString('en-IN')}</p>
                                    </div>
                                    <div>
                                        <p style="color: #64748B; font-size: 14px; margin-bottom: 5px;">Total Cost for ${paxCount} Pax</p>
                                        <p style="font-weight: bold; font-size: 20px; color: #15803D;">INR ${totalCostForPax.toLocaleString('en-IN')}</p>
                                    </div>
                                </div>
                                <div style="border-top: 1px solid #93C5FD; padding-top: 15px; text-align: center;">
                                    <p style="color: #374151; font-size: 14px; font-style: italic;">GST additional at 5% and is subject to RBI regulations.</p>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <hr class="separator-line" style="margin: 30px 0;" />
            ` : ''}

            <!-- Inclusions -->
            <h3 class="section-title">✅ Inclusions</h3>
            <ul class="list-check" style="list-style: none; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                ${inclusions.map(inc => `<li style="background: #ecfdf5; padding: 10px; border-radius: 6px; border: 1px solid #a7f3d0; color: #065f46;"><strong>✓</strong> ${inc.replace(/^(→ ?|✅ ?)/, "")}</li>`).join('')}
            </ul>

            <br style="page-break-before: always;">

            <!-- Rate Details -->
            <h3 class="section-title">💰 Financial Summary</h3>
            <table class="rate-table">
                <thead>
                    <tr>
                        <th style="text-align: left;">Description</th>
                        ${financials.map(f => `<th>${f.label}</th>${(f.childCosts || []).map(c => `<th>${c.label}</th>`).join('')}`).join('')}
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="text-align: left;">Room Sharing</td>
                        ${financials.map(f => `<td>${hotelCategory} (pp)</td>${(f.childCosts || []).map(() => `<td>Per Child</td>`).join('')}`).join('')}
                    </tr>
                    <tr>
                        <td style="text-align: left;">PACKAGE COST</td>
                        ${financials.map(f => `<td>₹${f.perPersonCost.toLocaleString('en-IN')}/-</td>${(f.childCosts || []).map(c => `<td>₹${c.landBaseCost.toLocaleString('en-IN')}/-</td>`).join('')}`).join('')}
                    </tr>
                    <tr>
                        <td style="text-align: left;">GST (5%)</td>
                        ${financials.map(f => `<td>₹${f.gstAmount.toLocaleString('en-IN')}/-</td>${(f.childCosts || []).map(c => `<td>₹${c.landGST.toLocaleString('en-IN')}/-</td>`).join('')}`).join('')}
                    </tr>
                     <tr>
                        <td style="text-align: left;">TCS (5%)</td>
                        ${financials.map(f => `<td>₹${f.tcsAmount.toLocaleString('en-IN')}/-</td>${(f.childCosts || []).map(c => `<td>₹${c.landTCS.toLocaleString('en-IN')}/-</td>`).join('')}`).join('')}
                    </tr>
                    <tr style="background-color: #eff6ff;">
                        <td style="text-align: left; font-weight: bold;">NET PACKAGE COST</td>
                        ${financials.map(f => `<td style="color: #2563EB; font-weight: bold;">₹${f.netCostPerPerson.toLocaleString('en-IN')}/-</td>${(f.childCosts || []).map(c => `<td style="color: #2563EB; font-weight: bold;">₹${c.netCost.toLocaleString('en-IN')}/-</td>`).join('')}`).join('')}
                    </tr>
                    <tr>
                         <td style="text-align: left;">Flight Booked</td>
                         ${financials.map(f => `<td>₹${f.addOnCost.toLocaleString('en-IN')}/-</td>${(f.childCosts || []).map(() => `<td>₹${f.addOnCost.toLocaleString('en-IN')}/-</td>`).join('')}`).join('')}
                    </tr>
                    <tr style="background-color: #fffbeb; font-weight: bold; font-size: 1.1em; border-top: 2px solid #fbbf24;">
                        <td style="text-align: left;">NET PAYABLE AMOUNT</td>
                         ${financials.map(f => `<td>₹${(f.netCostPerPerson + f.addOnCost).toLocaleString('en-IN')}/-</td>${(f.childCosts || []).map(c => `<td>₹${(c.netCost + f.addOnCost).toLocaleString('en-IN')}/-</td>`).join('')}`).join('')}
                    </tr>
                </tbody>
            </table>

            <!-- Total Summary -->
            <div style="background-color: #111827; color: white; padding: 25px; border-radius: 12px; margin-top: 30px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; align-items: center;">
                    <span style="font-size: 18px;">💰 Total Group Payable:</span>
                    <span style="color: #34d399; font-weight: 800; font-size: 24px;">₹${totalAmount.toLocaleString('en-IN')}/-</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px; align-items: center;">
                    <span style="font-size: 16px;">✅ Advance Received:</span>
                    <span style="font-weight: 600; font-size: 20px;">₹${amountReceived.toLocaleString('en-IN')}/-</span>
                </div>
                <div style="border-top: 1px solid #4b5563; padding-top: 15px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #f87171; font-weight: 700; font-size: 18px;">💳 Balance Due:</span>
                    <span style="font-size: 28px; font-weight: 800;">₹${balanceAmount.toLocaleString('en-IN')}/-</span>
                </div>
            </div>

            <!-- Exclusions -->
            <h3 class="section-title" style="margin-top: 40px;">❌ Exclusions</h3>
            <ul style="list-style: none; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                ${exclusions.map(exc => `<li style="background: #fef2f2; padding: 10px; border-radius: 6px; border: 1px solid #fecaca; color: #991b1b;"><span style="font-weight: bold; margin-right: 5px;">✕</span> ${exc.replace(/^(➡️ ?|❌ ?)/, "")}</li>`).join('')}
            </ul>

            <!-- Bank Details -->
            <h3 class="section-title">🏦 Payment Transfer Details</h3>
            <div class="bank-details">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700;">Account Name</p>
                        <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 16px;">${paymentDetails.accountHolder}</p>
                    </div>
                    <div>
                         <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700;">Account Number</p>
                        <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 18px; font-family: monospace;">${paymentDetails.accountNumber}</p>
                    </div>
                    <div>
                         <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700;">Bank Name</p>
                        <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 16px;">${paymentDetails.bankName}</p>
                    </div>
                    <div>
                         <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700;">IFSC Code</p>
                        <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 16px; font-family: monospace;">${paymentDetails.ifscCode}</p>
                    </div>
                </div>
                <div style="border-top: 1px dashed #cbd5e1; margin-top: 20px; padding-top: 20px; text-align: center;">
                    <p style="margin: 0; font-weight: bold; font-size: 14px; color: #475569;">GPay / PhonePe</p>
                    <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: 900; color: #15803d;">${paymentDetails.gpayNumber}</p>
                </div>
            </div>

            <!-- Footer -->
            <div class="text-center" style="margin-top: 50px;">
                <p style="margin-bottom: 20px; color: #6b7280; font-style: italic;">📞 For details or booking confirmation, please contact us.</p>
                <div style="display: flex; justify-content: center; gap: 20px; margin-top: 20px;">
                    <a href="tel:8884016046" style="text-decoration: none;">
                        <img src="https://res.cloudinary.com/dnauowwb0/image/upload/v1767504923/Call-Now-Button_gq6urr.png" alt="Call Now" style="height: 70px;" />
                    </a>
                    <a href="https://wa.me/8884016046" style="text-decoration: none;">
                        <img src="https://res.cloudinary.com/dnauowwb0/image/upload/v1767504923/Whatsapp-Button_kuwlcf.png" alt="WhatsApp" style="height: 79px;" />
                    </a>
                </div>
                <p style="margin-top: 30px; font-weight: bold; color: #1e3a8a; font-size: 22px;">Vishwanathan | +91-8884016046 |</p>
            </div>

            <img src="${HEADER_IMG_URL}" class="trip-explore-banner" style="margin-top: 40px; margin-bottom: 40px;" alt="Footer Banner" />

            <!-- TCS Rules Section -->
            <div style="margin-top: 40px; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 16px;">
                <h2 style="font-size: 22px; color: #1f2937; margin-top: 0;">TCS Rules</h2>
                <p><b>Note:</b> Effective 01 October 2023, Tax Collected at Source (TCS) shall be applicable as follows for Overseas Tour Packages / Cruises:</p>
                <ul style="margin-bottom: 20px;">
                    <li>5% TCS on cumulative payments up to ₹7,00,000</li>
                    <li>20% TCS on amounts exceeding ₹7,00,000</li>
                </ul>
                <p>This limit applies to all cumulative payments made against a PAN within the same Financial Year. The buyer is required to furnish an undertaking declaring their total spends on overseas tour packages/cruises during the financial year.</p>
                <p>The Government of India, Ministry of Finance, via Circular No. 10 of 2023 (F. No. 370142/12/2023-TPL) dated 30 June 2023, has clarified that:</p>
                <ul>
                    <li>The undertaking must be furnished by the buyer</li>
                    <li>Any false declaration will attract appropriate action under the Finance Act, 2023, as per the amended sub-section (1G) of Section 206C of the Income-tax Act, 1961</li>
                </ul>
            </div>
        </div>
    </body>
    </html>
    `;
};