// public/assets/js/flavor-data.js
// Defines the structure for flavor categories, descriptors, and educational tips.
// This data is used by feedback-form.js to dynamically build the feedback UI.

export const flavorCategories = {
    malty: {
      name: "Malty",
      description: "Malty flavors come from the grains used in brewing and can range from bread-like to caramel or toasted notes.",
      descriptors: [
        {
          id: "bready", // Unique ID within category, used for input IDs/names
          name: "Bready/Grainy", // Display name for the user
          education: "This flavor comes from base malts and resembles fresh bread, crackers, or grain. Common in lagers and lighter beers." // Educational tip
        },
        {
          id: "caramel",
          name: "Caramel/Toffee",
          education: "Crystal or caramel malts create these sweet, rich flavors. Common in amber ales, brown ales, and many British styles."
        },
        {
          id: "roasted",
          name: "Roasted/Chocolate",
          education: "Dark roasted malts provide coffee, chocolate, or roasted notes. Found in porters, stouts, and dark lagers."
        },
        {
          id: "nutty",
          name: "Nutty/Biscuit",
          education: "Medium-roasted specialty malts create nutty, biscuit flavors. Common in brown ales and some Belgian styles."
        }
      ]
    }, // End of malty category
  
    hoppy: {
      name: "Hoppy",
      description: "Hops add bitterness to balance malt sweetness and provide various aromas and flavors depending on variety and use.",
      descriptors: [
        {
          id: "floral",
          name: "Floral/Herbal",
          education: "These delicate aromas come from European noble hops like Saaz and Hallertau. Common in pilsners and many European styles."
        },
        {
          id: "citrus",
          name: "Citrus/Tropical",
          education: "American and New World hops provide bright citrus and tropical fruit notes. Prevalent in American IPAs and pale ales."
        },
        {
          id: "pine",
          name: "Pine/Resin",
          education: "Piney, resinous character comes from certain American hop varieties. Common in West Coast IPAs."
        },
        {
          id: "earthy",
          name: "Earthy/Spicy",
          education: "These subtle characters often come from European hops. Found in English ales and traditional continental styles."
        }
      ]
    }, // End of hoppy category
  
    yeasty: {
      name: "Yeast-Derived",
      description: "Yeast contributes significantly to flavor, especially in styles where fermentation character is highlighted.",
      descriptors: [
        {
          id: "fruity",
          name: "Fruity Esters",
          education: "These fruit-like flavors (apple, pear, berry) are produced by yeast during fermentation. Common in English ales, Belgian styles, and wheat beers."
        },
        {
          id: "spicy",
          name: "Spicy/Phenolic",
          education: "Clove, pepper, or spice-like compounds produced by certain yeast strains. Characteristic of Belgian styles & German wheat beers."
        },
        {
          id: "banana",
          name: "Banana/Bubblegum",
          education: "These distinctive flavors come from specific yeast strains, especially in German Hefeweizen and some Belgian ales."
        },
        {
          id: "funky",
          name: "Funky/Barnyard",
          education: "Wild yeasts (like Brettanomyces) and bacteria can create these complex, earthy, leathery, or 'horse blanket' flavors. Found in sour beers, farmhouse ales, and lambics."
        }
      ]
    }, // End of yeasty category
  
    mouthfeel: {
      name: "Mouthfeel",
      description: "Mouthfeel describes the physical sensations of the beer in your mouth, beyond just flavor.",
      descriptors: [
        {
          id: "body",
          name: "Body/Fullness",
          education: "Body ranges from thin and watery (light) to full and rich (heavy). Influenced by residual sugars, proteins, and alcohol."
        },
        {
          id: "carbonation",
          name: "Carbonation",
          education: "Describes the fizziness. Higher carbonation creates a prickly, effervescent sensation; lower carbonation feels smoother."
        },
        {
          id: "alcohol",
          name: "Alcohol Warmth",
          education: "The warming sensation from alcohol, felt in the throat/chest. Should be subtle in most styles, more pronounced in higher ABV beers, but never harsh or 'hot'."
        },
        {
          id: "astringency",
          name: "Astringency/Dryness",
          education: "A drying, sometimes puckering or grainy sensation, like unsweetened tea. Can come from hops (polyphenols), grains, or process issues. Distinct from bitterness."
        }
      ]
    }, // End of mouthfeel category
  
    faults: {
      name: "Potential Faults",
      description: "These flavors are typically considered off-flavors in most beer styles, though some may be acceptable at low levels in specific styles.",
      descriptors: [
        {
          id: "oxidized",
          name: "Oxidized/Papery",
          education: "Stale, cardboard, papery, or sherry-like flavors from oxygen exposure after fermentation. Usually indicates old or poorly handled beer."
        },
        {
          id: "diacetyl",
          name: "Buttery/Diacetyl",
          education: "Butter or butterscotch flavor/aroma. A fermentation byproduct. Acceptable (sometimes desired) at low levels in some English/Scottish ales, but a distinct fault in most lagers and other styles."
        },
        {
          id: "sulfur",
          name: "Sulfur/Eggy",
          education: "Rotten egg (hydrogen sulfide) or struck match (sulfur dioxide) aroma. Often appears during fermentation (especially lagers) but should dissipate in finished beer. Can indicate yeast stress."
        },
        {
          id: "skunky",
          name: "Skunky/Lightstruck",
          education: "Similar to a skunk's spray. Caused by a reaction between hop compounds and light (UV), particularly in green or clear bottles. Not a brewing fault, but a packaging/storage issue."
        }
        // Add others like 'medicinal', 'metallic', 'vegetal' as needed
      ]
    } // End of faults category
  }; // End of flavorCategories object