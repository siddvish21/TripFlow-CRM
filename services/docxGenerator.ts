
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign, ExternalHyperlink, UnderlineType, ShadingType, PageBreak } from 'docx';
import { QuotationData, ItineraryDay, HotelInfo, PaymentBankDetails } from '../types';
import { getHotelBannerBase64, getPartnerBannerBase64, getBestRateBadgeBase64, getTripExploreRatedBase64, getTopHeaderImageBase64, getCallButtonBase64, getWhatsappButtonBase64 } from './imageService';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    if (!base64) return new Uint8Array(0).buffer;
    try {
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    } catch (e) {
        console.error("Failed to decode base64 string", e);
        return new Uint8Array(0).buffer;
    }
}

// Financial calculation logic, matches App.tsx logic exactly
const calculateFinancials = (data: QuotationData) => {
    if (data.financialBreakdown && Array.isArray(data.financialBreakdown.options) && data.financialBreakdown.options.length > 0) {
        return data.financialBreakdown.options.map(opt => {
            const netCostPerPerson = opt.extractedNetCost || (opt.landBaseCost + opt.landGST + opt.landTCS);
            const netPayable = Math.round((netCostPerPerson + opt.addOnCost) * data.paxCount);
            return {
                label: opt.label,
                perPersonCost: Math.round(opt.landBaseCost),
                gstAmount: Math.round(opt.landGST),
                tcsAmount: Math.round(opt.landTCS),
                netCostPerPerson: Math.round(netCostPerPerson),
                addOnCost: Math.round(opt.addOnCost),
                netPayable: netPayable,
                childCosts: opt.childCosts
            };
        });
    }

    const { costDetails, paxCount, marginPercentage, isDomestic } = data;
    const perPersonCost = costDetails?.perPersonCost || 0;
    const gstPercentage = costDetails?.gstPercentage || 5;
    const marginAmount = perPersonCost * (marginPercentage / 100);
    const costWithMargin = perPersonCost + marginAmount;
    const gstAmount = costWithMargin * (gstPercentage / 100);
    const tcsPercentage = isDomestic ? 0 : (costDetails?.tcsPercentage || 5);
    const tcsAmount = (costWithMargin + gstAmount) * (tcsPercentage / 100);
    const netCostPerPerson = costWithMargin + gstAmount + tcsAmount;
    const netPayable = Math.round(netCostPerPerson * paxCount);

    return [{
        label: "Option 1",
        perPersonCost: Math.round(perPersonCost),
        gstAmount: Math.round(gstAmount),
        tcsAmount: Math.round(tcsAmount),
        netCostPerPerson: Math.round(netCostPerPerson),
        addOnCost: 0,
        netPayable: netPayable,
        childCosts: []
    }];
}


export const createDocx = async (data: QuotationData, paymentDetails: PaymentBankDetails): Promise<Blob> => {
    const [headerImageB64, partnerImageB64, rateBadgeB64, ratedLogoB64, topHeaderImageB64, callButtonB64, whatsappButtonB64] = await Promise.all([
        getHotelBannerBase64(),
        getPartnerBannerBase64(),
        getBestRateBadgeBase64(),
        getTripExploreRatedBase64(),
        getTopHeaderImageBase64(),
        getCallButtonBase64(),
        getWhatsappButtonBase64()
    ]);

    const headerImageBuffer = base64ToArrayBuffer(headerImageB64);
    const rateBadgeBuffer = base64ToArrayBuffer(rateBadgeB64);
    const ratedLogoBuffer = base64ToArrayBuffer(ratedLogoB64);
    const topHeaderImageBuffer = topHeaderImageB64 ? base64ToArrayBuffer(topHeaderImageB64) : null;
    const destImageBuffer = data.destinationImage ? base64ToArrayBuffer(data.destinationImage) : null;
    const callButtonBuffer = base64ToArrayBuffer(callButtonB64);
    const whatsappButtonBuffer = base64ToArrayBuffer(whatsappButtonB64);

    const { hotelCategory, totalAmount, amountReceived, balanceAmount, showAccommodations, adultsCount, childrenCount, childAges } = data;
    const financials = calculateFinancials(data);

    const tableCellBorders = {
        top: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
    };

    const totalWidth = 9500;

    const createRateRow = (label: string, values: string[], isHeader = false, isHighlight = false) => {
        return new TableRow({
            children: [
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: label, bold: isHeader || isHighlight })],
                        })
                    ],
                    borders: tableCellBorders,
                    shading: isHighlight ? { fill: "F3F4F6" } : undefined,
                    verticalAlign: VerticalAlign.CENTER
                }),
                ...values.map(val => new TableCell({
                    children: [new Paragraph({ text: val, alignment: AlignmentType.CENTER })],
                    borders: tableCellBorders,
                    shading: isHighlight ? { fill: "F3F4F6" } : undefined,
                    verticalAlign: VerticalAlign.CENTER
                }))
            ]
        });
    };

    const createHotelTable = (hotels: HotelInfo[]) => {
        return new Table({
            width: { size: 9500, type: WidthType.DXA },
            columnWidths: [2375, 3325, 2375, 1425], // Total: 9500 DXA (twips) - distributed proportionally
            rows: [
                new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Destination", bold: true })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER, borders: tableCellBorders, shading: { fill: "F3F4F6" } }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Hotel", bold: true })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER, borders: tableCellBorders, shading: { fill: "F3F4F6" } }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Room Category", bold: true })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER, borders: tableCellBorders, shading: { fill: "F3F4F6" } }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Nights", bold: true })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER, borders: tableCellBorders, shading: { fill: "F3F4F6" } }),
                    ],
                    tableHeader: true,
                }),
                ...hotels.map((hotel: HotelInfo) => new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ text: hotel.destination, alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER, borders: tableCellBorders }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: hotel.hotelName, bold: true })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER, borders: tableCellBorders }),
                        new TableCell({ children: [new Paragraph({ text: hotel.roomCategory, alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER, borders: tableCellBorders }),
                        new TableCell({ children: [new Paragraph({ text: hotel.nights.toString(), alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER, borders: tableCellBorders }),
                    ]
                }))
            ],
        });
    };

    const doc = new Document({
        styles: {
            paragraphStyles: [
                {
                    id: "normal", name: "Normal", basedOn: "Normal", next: "Normal",
                    run: { font: "Lexend", size: 32 }, // Increased from 28 to 32
                    paragraph: { spacing: { after: 120 } },
                },
                {
                    id: "ProblemHeader", name: "Problem Header", basedOn: "Normal", next: "Normal",
                    run: { font: "Lexend", size: 68, bold: true, color: "00AEEF" }, // Increased from 64 to 68
                    paragraph: { spacing: { before: 200, after: 100 } }
                },
                {
                    id: "RealityHeader", name: "Reality Header", basedOn: "Normal", next: "Normal",
                    run: { font: "Lexend", size: 40, bold: true, color: "000000" }, // Increased from 36 to 40
                    paragraph: { spacing: { before: 100, after: 100 } }
                },
                {
                    id: "TransparencyText", name: "Transparency Text", basedOn: "Normal", next: "Normal",
                    run: { font: "Lexend", size: 36, color: "333333" }, // Increased from 32 to 36
                    paragraph: { spacing: { after: 150 } }
                },
                {
                    id: "dayBox", name: "Day Box", basedOn: "Normal", next: "Normal",
                    run: { font: "Lexend", size: 36, bold: true, color: "003366" }, // Increased from 32 to 36
                    paragraph: {
                        spacing: { before: 400, after: 150 },
                        indent: { left: 200 }
                    },
                },
                {
                    id: "itineraryPoint", name: "Itinerary Point", basedOn: "Normal", next: "Normal",
                    run: { font: "Lexend", size: 30 }, // Increased from 26 to 30
                    paragraph: {
                        indent: { left: 800, hanging: 300 },
                        spacing: { after: 120 }
                    },
                }
            ],
        },
        sections: [{
            children: [
                // 1. Top Header Image
                ...(topHeaderImageBuffer ? [
                    new Paragraph({
                        children: [new ImageRun({ data: topHeaderImageBuffer, transformation: { width: 638, height: 209 } })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 100 }
                    })
                ] : []),

                // 2. Collaboration Message
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 200 },
                    children: [
                        new TextRun({ text: "🤝 In ", font: "Lexend", bold: true, italics: true, size: 30, color: "333333" }),
                        new TextRun({ text: "collaboration", font: "Lexend", bold: true, italics: true, underline: { type: UnderlineType.SINGLE }, shading: { type: ShadingType.CLEAR, fill: "FFFF00" }, size: 30, color: "000000" }),
                        new TextRun({ text: " with our trusted partners at TripExplore – crafting seamless travel experiences together.", font: "Lexend", bold: true, italics: true, size: 30, color: "333333" }),
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 200 },
                    children: [
                        new ExternalHyperlink({
                            children: [
                                new TextRun({ text: "🔗 Know more about them at: www.tripexplore.in", font: "Lexend", size: 28, color: "0000FF", underline: { type: UnderlineType.SINGLE } })
                            ],
                            link: "https://www.tripexplore.in"
                        })
                    ]
                }),



                // 4. Main Banner
                ...(headerImageBuffer.byteLength > 0 ? [
                    new Paragraph({
                        children: [new ImageRun({ data: headerImageBuffer, transformation: { width: 620, height: 203 } })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 600 }
                    })
                ] : []),

                // --- TRANSPARENCY SECTION ---
                new Paragraph({ text: "Problem 1", style: "ProblemHeader" }),
                new Paragraph({ text: "People think we only give tours with the hotels shown in our quote.", style: "TransparencyText" }),
                new Paragraph({ text: "Reality", style: "RealityHeader" }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "Nope! We can plan your trip with ", italics: true }),
                        new TextRun({ text: "any hotel you like", italics: true, bold: true, color: "000000" }),
                        new TextRun({ text: " and add ", italics: true }),
                        new TextRun({ text: "any sightseeing", italics: true, bold: true, color: "000000" }),
                        new TextRun({ text: " you want.", italics: true }),
                    ],
                    style: "TransparencyText",
                    spacing: { after: 400 }
                }),

                new Paragraph({ text: "Problem 2", style: "ProblemHeader" }),
                new Paragraph({ text: "People see one price (like Rs 50,000) and another lower price (like Rs 48,000) and quickly book the cheaper one.", style: "TransparencyText" }),
                new Paragraph({ text: "Solution", style: "RealityHeader" }),
                new Paragraph({ text: "Prices change because hotels and sightseeing are different.", style: "TransparencyText" }),
                new Paragraph({
                    children: [new TextRun({ text: "• One hotel may be close to the city and safe for tourists, another may be far away.", font: "Lexend", size: 32 })],
                    indent: { left: 400 },
                    spacing: { after: 100 }
                }),
                new Paragraph({
                    children: [new TextRun({ text: "• One hotel may cost Rs 5,000 a night, another Rs 2,500, even in the same area.", font: "Lexend", size: 36 })],
                    indent: { left: 400 },
                    spacing: { after: 200 }
                }),
                new Paragraph({
                    text: "So, always check what’s included before booking. If you like another quote, share it with us—we’ll match the same hotel and sightseeing so you can compare fairly.",
                    style: "TransparencyText",
                    spacing: { before: 200, after: 600 }
                }),

                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({
                            text: "\"Let’s talk openly, like friends, and make sure you get the best deal possible.\"",
                            bold: true,
                            italics: true,
                            size: 40,
                            color: "003366"
                        })
                    ],
                    spacing: { before: 400 }
                }),

                new Paragraph({ children: [new PageBreak()] }),

                // --- QUOTATION DETAILS ---
                ...(destImageBuffer && destImageBuffer.byteLength > 0 ? [
                    new Paragraph({
                        children: [new ImageRun({ data: destImageBuffer, transformation: { width: 600, height: 300 } })],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 100, after: 400 }
                    })
                ] : []),

                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({ text: "Quotation for ", font: "Lexend", size: 36, bold: true }),
                        new TextRun({ text: data.customerName, font: "Lexend", size: 36, bold: true, color: "003366", underline: { type: UnderlineType.SINGLE } })
                    ],
                    spacing: { after: 400 }
                }),

                // Styled Table Box for Brief
                new Table({
                    width: { size: 9500, type: WidthType.DXA },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    shading: { fill: "F9FAFB" },
                                    borders: tableCellBorders,
                                    children: [
                                        new Paragraph({ children: [
                                            new TextRun({ text: "👥 PAX: ", bold: true }), 
                                            new TextRun(`${adultsCount || 0} Adults + ${childrenCount || 0} Child`),
                                            ...(childAges ? [new TextRun({ text: ` (Age: ${childAges})`, size: 24, color: "666666" })] : [])
                                        ] }),
                                        new Paragraph({ children: [new TextRun({ text: "📍 Destination: ", bold: true }), new TextRun(data.destination)] }),
                                        new Paragraph({ children: [new TextRun({ text: "⏳ Duration: ", bold: true }), new TextRun(data.duration)] }),
                                        new Paragraph({ children: [new TextRun({ text: "🗓️ Dates: ", bold: true }), new TextRun(data.dates)] }),
                                        new Paragraph({ children: [new TextRun({ text: "🍲 Meal Plan: ", bold: true }), new TextRun(data.mealPlan)] }),
                                        new Paragraph({ children: [new TextRun({ text: "🚗 Vehicle: ", bold: true }), new TextRun(data.vehicle)] }),
                                    ],
                                    margins: { top: 200, bottom: 200, left: 200, right: 200 }
                                })
                            ]
                        })
                    ]
                }),

                new Paragraph({ text: data.itineraryTitle, heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER, spacing: { before: 600, after: 400 } }),

                ...data.itinerary.flatMap((day: ItineraryDay) => {
                    // Removed word limit to preserve full itinerary content
                    const formatPoint = (point: string) => point.replace(/^[→•]\s*/, "").trim();
                    const v = (data.vehicle || "").toLowerCase();
                    const mode = v.includes("sic") ? "Shared (SIC)" : (v.includes("private") ? "Private" : undefined);
                    const type = v.includes("sedan") ? "Sedan" : v.includes("suv") ? "SUV" : v.includes("tempo") ? "Tempo Traveller" : v.includes("coach") ? "Coach" : undefined;
                    const title = (day.title || "").toLowerCase();
                    const synthetic: string[] = [];
                    if (/arrival/.test(title)) {
                        synthetic.push(`Arrival transfer (${mode || 'Private'} ${type || 'Sedan'}): Airport → Hotel`);
                    }
                    if (/departure/.test(title)) {
                        synthetic.push(`Departure transfer (${mode || 'Private'} ${type || 'Sedan'}): Hotel → Airport`);
                    }
                    if (/transfer/.test(title) && !/arrival|departure/.test(title)) {
                        synthetic.push(`City transfer (${mode || 'Private'} ${type || 'Sedan'}): Hotel → City Center`);
                        if ((day.points || []).some(p => /en[- ]?route|on the way|road/i.test(p))) {
                            synthetic.push(`En-route sightseeing (30–45 min): key attractions`);
                        }
                    }
                    if (/disposal/.test(title)) {
                        const hoursMatch = (day.points || []).map(p => p.match(/(\d{1,2})\s*h/)).find(Boolean) as RegExpMatchArray | undefined;
                        const hours = hoursMatch ? `${hoursMatch[1]}h` : '8h';
                        synthetic.push(`Vehicle disposal (${mode || 'Private'} ${type || 'Sedan'}) — duration ${hours}`);
                    }
                    let pts = [...synthetic, ...(day.points || []).map(formatPoint)].filter(Boolean);
                    // Tickets marking
                    pts = pts.map(p => /ticket|entry|admission|pass/i.test(p) && !/ticket/i.test(p) ? `${p} — tickets included` : p);
                    // Ensure min 2, max 5; keep engaging, concise
                    const fillers = [
                        `${mode || 'Private'} ${type || 'Sedan'} city transfer`,
                        `Guided city tour (SIC)`,
                        `Optional en-route sightseeing (30–45 min)`
                    ];
                    while (pts.length < 2 && fillers.length) {
                        const f = fillers.shift()!;
                        pts.push(f);
                    }
                    pts = pts.slice(0, 5);
                    return [
                        new Paragraph({
                            text: `🗓️ Day ${day.day}: ${day.title}`,
                            style: "dayBox",
                        }),
                        ...pts.map(point => new Paragraph({
                            children: [
                                new TextRun({ text: "→ ", font: "Lexend", color: "4299E1" }),
                                new TextRun({ text: point, font: "Lexend" })
                            ],
                            style: "itineraryPoint",
                        }))
                    ];
                }),

                // Hotels Section
                ...(showAccommodations !== false ? [
                    new Paragraph({ text: "Your Accommodations", heading: HeadingLevel.HEADING_2, spacing: { before: 800, after: 400 } }),
                    ...(data.hotelOptions && data.hotelOptions.length > 0
                        ? data.hotelOptions.flatMap(opt => [
                            new Paragraph({
                                children: [new TextRun({ text: opt.optionLabel, bold: true, color: "003366", size: 28 })],
                                spacing: { before: 200, after: 100 }
                            }),
                            createHotelTable(opt.hotels)
                        ])
                        : (data.hotels && data.hotels.length > 0 ? [createHotelTable(data.hotels)] : [])
                    ),
                ] : []),

                // Package Cost Summary Section (Before Inclusions)
                ...(financials && financials.length > 0 ? [
                    new Paragraph({ text: "💰 Package Cost Summary", heading: HeadingLevel.HEADING_2, spacing: { before: 800, after: 400 } }),
                    ...financials.map((opt: any, i: number) => {
                        const costPerHead = opt.netCostPerPerson + opt.addOnCost;
                        const totalCostForPax = costPerHead * data.paxCount;
                        
                        return new Table({
                            width: { size: 9500, type: WidthType.DXA },
                            columnWidths: [4750, 4750],
                            rows: [
                                // Option Label Header
                                new TableRow({
                                    children: [
                                        new TableCell({
                                            columnSpan: 2,
                                            shading: { fill: "DBEAFE" },
                                            children: [new Paragraph({ 
                                                children: [new TextRun({ text: opt.label || `Option ${i + 1}`, bold: true, size: 28 })], 
                                                alignment: AlignmentType.CENTER 
                                            })],
                                            borders: tableCellBorders
                                        })
                                    ]
                                }),
                                // Cost Per Head
                                new TableRow({
                                    children: [
                                        new TableCell({
                                            children: [new Paragraph({ 
                                                children: [new TextRun({ text: "Cost Per Head", size: 22 })] 
                                            })],
                                            borders: tableCellBorders,
                                            shading: { fill: "FFFFFF" }
                                        }),
                                        new TableCell({
                                            children: [new Paragraph({ 
                                                children: [new TextRun({ text: `INR ${costPerHead.toLocaleString('en-IN')}`, bold: true, size: 24, color: "1E40AF" })],
                                                alignment: AlignmentType.CENTER
                                            })],
                                            borders: tableCellBorders,
                                            shading: { fill: "FFFFFF" }
                                        })
                                    ]
                                }),
                                // Total Cost for n Pax
                                new TableRow({
                                    children: [
                                        new TableCell({
                                            children: [new Paragraph({ 
                                                children: [new TextRun({ text: `Total Cost for ${data.paxCount} Pax`, size: 22 })] 
                                            })],
                                            borders: tableCellBorders,
                                            shading: { fill: "FFFFFF" }
                                        }),
                                        new TableCell({
                                            children: [new Paragraph({ 
                                                children: [new TextRun({ text: `INR ${totalCostForPax.toLocaleString('en-IN')}`, bold: true, size: 24, color: "15803D" })],
                                                alignment: AlignmentType.CENTER
                                            })],
                                            borders: tableCellBorders,
                                            shading: { fill: "FFFFFF" }
                                        })
                                    ]
                                }),
                                // GST Note
                                new TableRow({
                                    children: [
                                        new TableCell({
                                            columnSpan: 2,
                                            children: [new Paragraph({ 
                                                children: [new TextRun({ text: "GST additional at 5% and is subject to RBI regulations.", size: 20, italics: true, color: "374151" })],
                                                alignment: AlignmentType.CENTER,
                                                spacing: { before: 200, after: 200 }
                                            })],
                                            borders: tableCellBorders,
                                            shading: { fill: "F9FAFB" }
                                        })
                                    ]
                                })
                            ]
                        });
                    }),
                    new Paragraph({ text: "", spacing: { after: 400 } })
                ] : []),

                // Inclusions structured with headings and subheadings
                new Paragraph({ text: "✅ Inclusions", heading: HeadingLevel.HEADING_2, spacing: { before: 800, after: 200 } }),
                ...(() => {
                    const inc = (data.inclusions || []).filter(Boolean);
                    const tours: string[] = [];
                    const transfers: string[] = [];
                    const tickets: string[] = [];
                    const meals: string[] = [];
                    inc.forEach(s => {
                        const t = s.toLowerCase();
                        if (/(tour|excursion|sightseeing)/.test(t)) tours.push(s);
                        else if (/(transfer|airport|intercity|coach|pickup|drop)/.test(t)) transfers.push(s);
                        else if (/(ticket|entry|admission|pass)/.test(t)) tickets.push(s);
                        else if (/(breakfast|meal|dinner|lunch|accommodation|stay|hotel)/.test(t)) meals.push(s);
                        else tours.push(s);
                    });
                    const mkSection = (title: string, items: string[]) => items.length ? [
                        new Paragraph({ text: title, heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 } }),
                        ...items.map(inclusion => new Paragraph({
                            children: [
                                new TextRun({ text: "✓ ", bold: true, color: "10B981" }),
                                new TextRun(inclusion.replace(/^(→ ?|✅ ?)/, ""))
                            ],
                            style: "normal",
                            indent: { left: 400 }
                        }))
                    ] : [];
                    return [
                        ...mkSection("Tours", tours),
                        ...mkSection("Transfers", transfers),
                        ...mkSection("Tickets", tickets),
                        ...mkSection("Accommodation & Meals", meals),
                    ];
                })(),

                // Rate Details (Pro Table)
                new Paragraph({ text: "Rate Details", heading: HeadingLevel.HEADING_2, spacing: { before: 800, after: 400 } }),
                // Rate Details (Pro Table) - Redesigned
                new Paragraph({ text: "Rate Details", heading: HeadingLevel.HEADING_2, spacing: { before: 800, after: 400 } }),

                ...financials.map((f, index) => {
                    const child = f.childCosts && f.childCosts.length > 0 ? f.childCosts[0] : null;
                    const adultCount = data.adultsCount || data.paxCount;
                    const childCount = data.childrenCount || 0;
                    const adultSubtotal = (f.netCostPerPerson + f.addOnCost) * adultCount;
                    const childSubtotal = child ? (child.netCost + f.addOnCost) * childCount : 0;

                    // Note: 'f.netPayable' from calculation includes everything? 
                    // In 'calculateFinancials', netPayable = (netCostPerPerson + addOnCost) * data.paxCount.

                    // We'll trust the 'netPayable' passed in f for the adult part (or total group?), 
                    // actually f.netPayable in calculateFinancials equals adult part.
                    // Let's rely on per-person math for clarity in the table rows.

                    return new Table({
                        width: { size: 9500, type: WidthType.DXA },
                        columnWidths: [3800, 2850, 2850], // Description, Adults, Child columns
                        rows: [
                            // 1. Header (Option Label)
                            new TableRow({
                                children: [
                                    new TableCell({
                                        columnSpan: 3,
                                        shading: { fill: "333333" },
                                        children: [new Paragraph({ children: [new TextRun({ text: f.label || `Option ${index + 1}`, bold: true, color: "FFFFFF", size: 28 })], alignment: AlignmentType.CENTER })],
                                        borders: tableCellBorders
                                    })
                                ]
                            }),
                            // 2. Sub-Header (Columns)
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Description", bold: true })] })], borders: tableCellBorders, shading: { fill: "F3F4F6" } }),
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Adults", bold: true })], alignment: AlignmentType.CENTER })], borders: tableCellBorders, shading: { fill: "F3F4F6" } }),
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Child", bold: true })], alignment: AlignmentType.CENTER })], borders: tableCellBorders, shading: { fill: "F3F4F6" } }),
                                ]
                            }),
                            // 3. Occupancy
                            createRateRow("Occupancy / Sharing", [hotelCategory, child ? "With/No Bed" : "N/A"]),

                            // 4. Base Package Cost
                            createRateRow("Base Package Cost", [
                                `INR ${f.perPersonCost.toLocaleString('en-IN')}`,
                                child ? `INR ${child.landBaseCost.toLocaleString('en-IN')}` : "-"
                            ]),

                            // 5. Taxes
                            createRateRow("GST (5%)", [
                                `INR ${f.gstAmount.toLocaleString('en-IN')}`,
                                child ? `INR ${child.landGST.toLocaleString('en-IN')}` : "-"
                            ]),
                            createRateRow("TCS (5%)", [
                                `INR ${f.tcsAmount.toLocaleString('en-IN')}`,
                                child ? `INR ${child.landTCS.toLocaleString('en-IN')}` : "-"
                            ]),

                            // 6. Net Package Cost (Per Head) - Shaded
                            createRateRow("Net Package Cost (Per Head)", [
                                `INR ${f.netCostPerPerson.toLocaleString('en-IN')}`,
                                child ? `INR ${child.netCost.toLocaleString('en-IN')}` : "-"
                            ], true, true), // Highlighted row

                            // 7. Flight Cost Indicator
                            createRateRow("Flight Cost Indicator", [
                                f.addOnCost > 0 ? `INR ${f.addOnCost.toLocaleString('en-IN')}` : "Excluded",
                                f.addOnCost > 0 ? `INR ${f.addOnCost.toLocaleString('en-IN')}` : "Excluded"
                            ]),

                            // 8. Net Payable Amount (Category Subtotal)
                            createRateRow("Net Payable Amount (Category Total)", [
                                `INR ${adultSubtotal.toLocaleString('en-IN')} (x${adultCount})`,
                                child ? `INR ${childSubtotal.toLocaleString('en-IN')} (x${childCount})` : "-"
                            ]),

                            // 9. Grand Total (Merged)
                            new TableRow({
                                children: [
                                    new TableCell({
                                        columnSpan: 2,
                                        children: [new Paragraph({ children: [new TextRun({ text: "GRAND TOTAL (Inc. Taxes)", bold: true })], alignment: AlignmentType.RIGHT })],
                                        borders: tableCellBorders,
                                        verticalAlign: VerticalAlign.CENTER
                                    }),
                                    new TableCell({
                                        children: [new Paragraph({
                                            children: [new TextRun({ text: `INR ${(adultSubtotal + childSubtotal).toLocaleString('en-IN')}/-`, bold: true, color: "FF0000", size: 36 })],
                                            alignment: AlignmentType.CENTER
                                        })],
                                        borders: tableCellBorders,
                                        verticalAlign: VerticalAlign.CENTER,
                                        shading: { fill: "FEE2E2" } // Light red background
                                    })
                                ]
                            })
                        ]
                    });
                }),

                // Final Summary Box
                new Paragraph({ spacing: { before: 600 } }),
                new Table({
                    width: { size: 9500, type: WidthType.DXA },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    shading: { fill: "111827" },
                                    borders: tableCellBorders,
                                    margins: { top: 300, bottom: 300, left: 300, right: 300 },
                                    children: [
                                        new Paragraph({ children: [new TextRun({ text: "💰 Total Group Payable: ", color: "FFFFFF", size: 36 }), new TextRun({ text: `₹${totalAmount.toLocaleString('en-IN')}/-`, bold: true, color: "10B981", size: 40 })] }),
                                        new Paragraph({ children: [new TextRun({ text: "✅ Advance Received: ", color: "60A5FA", size: 32 }), new TextRun({ text: `₹${amountReceived.toLocaleString('en-IN')}/-`, color: "FFFFFF", size: 32 })] }),
                                        new Paragraph({ children: [new TextRun({ text: "💳 Balance Due: ", color: "F87171", bold: true, size: 32 }), new TextRun({ text: `₹${balanceAmount.toLocaleString('en-IN')}/-`, bold: true, color: "FFFFFF", size: 36 })] }),
                                    ]
                                })
                            ]
                        })
                    ]
                }),

                // Exclusions
                new Paragraph({ text: "❌ Exclusions", heading: HeadingLevel.HEADING_2, spacing: { before: 800, after: 400 } }),
                ...data.exclusions.map(exclusion => new Paragraph({
                    children: [
                        new TextRun({ text: "✕ ", bold: true, color: "EF4444" }),
                        new TextRun(exclusion.replace(/^(➡️ ?|❌ ?)/, ""))
                    ],
                    style: "normal",
                    indent: { left: 400 }
                })),

                // Bank Details
                new Paragraph({ text: "🏦 Payment Transfer Details", heading: HeadingLevel.HEADING_2, spacing: { before: 800, after: 400 } }),
                new Table({
                    width: { size: 9500, type: WidthType.DXA },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    shading: { fill: "F3F4F6" },
                                    borders: tableCellBorders,
                                    margins: { top: 200, bottom: 200, left: 200, right: 200 },
                                    children: [
                                        new Paragraph({ children: [new TextRun({ text: "Account Name: ", bold: true }), new TextRun(paymentDetails.accountHolder)] }),
                                        new Paragraph({ children: [new TextRun({ text: "Account Number: ", bold: true }), new TextRun({ text: paymentDetails.accountNumber, font: "Courier New" })] }),
                                        new Paragraph({ children: [new TextRun({ text: "Bank Name: ", bold: true }), new TextRun(paymentDetails.bankName)] }),
                                        new Paragraph({ children: [new TextRun({ text: "IFSC Code: ", bold: true }), new TextRun({ text: paymentDetails.ifscCode, color: "B91C1C" })] }),
                                        new Paragraph({ children: [new TextRun({ text: "GPAY Number: ", bold: true }), new TextRun({ text: paymentDetails.gpayNumber, bold: true, color: "15803D" })] }),
                                    ]
                                })
                            ]
                        })
                    ]
                }),

                // Contact
                new Paragraph({ text: "📞 For further details or confirmation, feel free to contact us anytime.", style: "normal", spacing: { before: 600 } }),
                new Paragraph({ text: "Best Regards,", style: "normal" }),
                new Paragraph({ children: [new TextRun({ text: "Vishwanathan | +91-8884016046 |", bold: true, size: 36, color: "1E3A8A" })], spacing: { after: 200 } }),

                // CTA Buttons
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        ...(callButtonBuffer.byteLength > 0 ? [
                            new ExternalHyperlink({
                                children: [
                                    new ImageRun({ data: callButtonBuffer, transformation: { width: 210, height: 70 } }), // 2.19in x 0.73in @ 96DPI
                                ],
                                link: "tel:8884016046"
                            })
                        ] : []),
                        new TextRun("   "), // Spacer
                        ...(whatsappButtonBuffer.byteLength > 0 ? [
                            new ExternalHyperlink({
                                children: [
                                    new ImageRun({ data: whatsappButtonBuffer, transformation: { width: 237, height: 79 } }), // 2.47in x 0.82in @ 96DPI
                                ],
                                link: "https://wa.me/8884016046"
                            })
                        ] : [])
                    ],
                    spacing: { after: 400 }
                }),

                // Footer images & final collab
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        ...(rateBadgeBuffer.byteLength > 0 ? [new ImageRun({ data: rateBadgeBuffer, transformation: { width: 100, height: 100 } })] : []),
                        new TextRun("     "),
                        ...(ratedLogoBuffer.byteLength > 0 ? [new ImageRun({ data: ratedLogoBuffer, transformation: { width: 100, height: 80 } })] : [])
                    ],
                    spacing: { before: 400, after: 400 }
                }),

                ...(headerImageBuffer.byteLength > 0 ? [
                    new Paragraph({
                        children: [new ImageRun({ data: headerImageBuffer, transformation: { width: 620, height: 203 } })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 400 }
                    })
                ] : []),

                // TCS Rules Section
                new Paragraph({ text: "TCS Rules", heading: HeadingLevel.HEADING_2, spacing: { before: 400, after: 200 } }),
                new Paragraph({
                    children: [new TextRun({ text: "Note:", bold: true, size: 28 })],
                    spacing: { after: 100 }
                }),
                new Paragraph({
                    text: "Effective 01 October 2023, Tax Collected at Source (TCS) shall be applicable as follows for Overseas Tour Packages / Cruises:",
                    style: "normal"
                }),
                new Paragraph({
                    children: [new TextRun({ text: "• 5% TCS on cumulative payments up to ₹7,00,000", size: 28 })],
                    indent: { left: 400 }
                }),
                new Paragraph({
                    children: [new TextRun({ text: "• 20% TCS on amounts exceeding ₹7,00,000", size: 28 })],
                    indent: { left: 400 },
                    spacing: { after: 200 }
                }),
                new Paragraph({
                    text: "This limit applies to all cumulative payments made against a PAN within the same Financial Year. The buyer is required to furnish an undertaking declaring their total spends on overseas tour packages/cruises during the financial year.",
                    style: "normal"
                }),
                new Paragraph({
                    text: "The Government of India, Ministry of Finance, via Circular No. 10 of 2023 (F. No. 370142/12/2023-TPL) dated 30 June 2023, has clarified that:",
                    style: "normal"
                }),
                new Paragraph({
                    children: [new TextRun({ text: "• The undertaking must be furnished by the buyer", size: 28 })],
                    indent: { left: 400 }
                }),
                new Paragraph({
                    children: [new TextRun({ text: "• Any false declaration will attract appropriate action under the Finance Act, 2023, as per the amended sub-section (1G) of Section 206C of the Income-tax Act, 1961", size: 28 })],
                    indent: { left: 400 }
                }),
            ],
        }],
    });

    return Packer.toBlob(doc);
};
