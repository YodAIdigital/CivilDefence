/**
 * Emergency Preparedness Guide Templates
 * These are default templates that communities can select and customize
 */

export type DisasterType =
  | 'fire'
  | 'flood'
  | 'strong_winds'
  | 'earthquake'
  | 'tsunami'
  | 'snow'
  | 'pandemic'
  | 'solar_storm'
  | 'invasion'

export interface GuideSection {
  id: string
  title: string
  content: string
  icon?: string
}

export interface GuideTemplate {
  id: string
  type: DisasterType
  name: string
  description: string
  icon: string
  color: string
  sections: {
    before: GuideSection[]
    during: GuideSection[]
    after: GuideSection[]
  }
  supplies: string[]
  emergencyContacts: {
    name: string
    number: string
    description: string
  }[]
}

export interface CommunityGuide extends GuideTemplate {
  communityId: string
  isEnabled: boolean
  customizations?: {
    additionalSections?: GuideSection[]
    additionalSupplies?: string[]
    localContacts?: { name: string; number: string; description: string }[]
    notes?: string
  }
  lastUpdated: string
  updatedBy: string
}

export const guideTemplates: GuideTemplate[] = [
  {
    id: 'fire-template',
    type: 'fire',
    name: 'Wildfire & Fire Emergency',
    description: 'Comprehensive guide for preparing, responding to, and recovering from fire emergencies including wildfires and house fires.',
    icon: 'local_fire_department',
    color: 'from-orange-500 to-red-600',
    sections: {
      before: [
        {
          id: 'fire-before-1',
          title: 'Create a Defensible Space',
          content: 'Clear vegetation and debris within 30 feet of your home. Remove dead plants, dry leaves, and flammable materials. Trim tree branches that hang over roofs. Keep lawns mowed and watered.',
          icon: 'yard'
        },
        {
          id: 'fire-before-2',
          title: 'Prepare Your Home',
          content: 'Install smoke detectors on every level and test monthly. Keep fire extinguishers accessible. Consider fire-resistant roofing and siding materials. Install spark arresters on chimneys.',
          icon: 'home'
        },
        {
          id: 'fire-before-3',
          title: 'Plan Evacuation Routes',
          content: 'Identify at least two evacuation routes from your area. Know where emergency shelters are located. Practice evacuation drills with your family. Keep car fuel tank at least half full during fire season.',
          icon: 'route'
        },
        {
          id: 'fire-before-4',
          title: 'Prepare Emergency Kit',
          content: 'Pack important documents, medications, and valuables for quick evacuation. Include N95 masks for smoke protection. Keep a "go bag" ready by the door during high-risk periods.',
          icon: 'backpack'
        }
      ],
      during: [
        {
          id: 'fire-during-1',
          title: 'Evacuate Immediately When Ordered',
          content: 'Leave as soon as evacuation is recommended or ordered. Do not wait until the last minute. Follow designated evacuation routes. Do not attempt to drive through smoke or flames.',
          icon: 'directions_run'
        },
        {
          id: 'fire-during-2',
          title: 'If Trapped in Your Home',
          content: 'Call 111 immediately. Stay inside away from outside walls. Close all windows, doors, and vents. Fill sinks and tubs with water. Stay low if there is smoke.',
          icon: 'shield'
        },
        {
          id: 'fire-during-3',
          title: 'Protect Yourself from Smoke',
          content: 'Wear N95 masks when outdoors. Limit outdoor activity. Keep windows and doors closed. Use air conditioning on recirculate mode. Monitor air quality reports.',
          icon: 'masks'
        },
        {
          id: 'fire-during-4',
          title: 'Stay Informed',
          content: 'Monitor local news and emergency alerts. Follow instructions from emergency services. Keep your phone charged for emergency communications. Check on neighbours, especially elderly or disabled.',
          icon: 'radio'
        }
      ],
      after: [
        {
          id: 'fire-after-1',
          title: 'Return Home Safely',
          content: 'Only return when authorities say it is safe. Watch for hazards like hot spots, downed power lines, and weakened structures. Wear protective clothing and sturdy shoes.',
          icon: 'home'
        },
        {
          id: 'fire-after-2',
          title: 'Document Damage',
          content: 'Take photos and videos of all damage for insurance claims. Make a list of damaged items. Contact your insurance company promptly. Keep receipts for all expenses.',
          icon: 'photo_camera'
        },
        {
          id: 'fire-after-3',
          title: 'Avoid Health Hazards',
          content: 'Wear an N95 mask during cleanup. Do not use water that may be contaminated. Discard food exposed to heat, smoke, or soot. Watch for signs of emotional distress.',
          icon: 'health_and_safety'
        },
        {
          id: 'fire-after-4',
          title: 'Seek Assistance',
          content: 'Contact local emergency management for assistance programs. Apply for disaster relief if available. Reach out to community support organizations. Check on mental health resources.',
          icon: 'support_agent'
        }
      ]
    },
    supplies: [
      'N95 respirator masks (multiple)',
      'Fire extinguisher (ABC rated)',
      'Smoke detectors with extra batteries',
      'Garden hose long enough to reach all areas',
      'Ladder for roof access',
      'Wool blankets (for fire protection)',
      'Goggles for eye protection',
      'Sturdy work gloves',
      'Battery-powered radio',
      'Flashlights and extra batteries',
      'First aid kit',
      'Important documents in fireproof container',
      'Cash in small denominations',
      'Phone chargers and power bank',
      'Pet carriers and pet supplies'
    ],
    emergencyContacts: [
      { name: 'Emergency Services', number: '111', description: 'Fire, Police, Ambulance' },
      { name: 'Fire and Emergency NZ', number: '0800 473 473', description: 'Non-emergency enquiries' }
    ]
  },
  {
    id: 'flood-template',
    type: 'flood',
    name: 'Flood Emergency',
    description: 'Guide for preparing and responding to floods, flash floods, and storm surge events.',
    icon: 'water',
    color: 'from-blue-500 to-cyan-600',
    sections: {
      before: [
        {
          id: 'flood-before-1',
          title: 'Know Your Risk',
          content: 'Determine if you live in a flood-prone area. Understand flood warning systems in your area. Know the difference between flood watches and warnings. Identify high ground near your home.',
          icon: 'map'
        },
        {
          id: 'flood-before-2',
          title: 'Protect Your Property',
          content: 'Install check valves in plumbing. Consider flood insurance (standard insurance often does not cover floods). Elevate electrical systems, water heaters, and appliances. Clear gutters and drains regularly.',
          icon: 'home'
        },
        {
          id: 'flood-before-3',
          title: 'Prepare Emergency Supplies',
          content: 'Store drinking water (4 litres per person per day for 3 days minimum). Keep supplies on upper floors if possible. Include waterproof containers for important documents. Have sandbags or flood barriers ready.',
          icon: 'inventory_2'
        },
        {
          id: 'flood-before-4',
          title: 'Plan for Evacuation',
          content: 'Know evacuation routes to higher ground. Have a plan for pets and livestock. Arrange meeting points with family members. Keep car fuel tank full during flood season.',
          icon: 'route'
        }
      ],
      during: [
        {
          id: 'flood-during-1',
          title: 'Move to Higher Ground',
          content: 'Evacuate if told to do so. Move to higher ground if flooding begins. Do not wait for instructions if you sense danger. Take essential items only.',
          icon: 'terrain'
        },
        {
          id: 'flood-during-2',
          title: 'Never Drive or Walk Through Flood Water',
          content: 'Turn around, do not drown. Just 15cm of moving water can knock you down. 60cm of water can float a car. Roads may be washed away under flood water.',
          icon: 'no_transfer'
        },
        {
          id: 'flood-during-3',
          title: 'Stay Away from Electrical Equipment',
          content: 'Do not touch electrical equipment if wet or standing in water. Turn off electricity at the main if safe to do so. Do not use electrical appliances that have been wet.',
          icon: 'bolt'
        },
        {
          id: 'flood-during-4',
          title: 'If Trapped in a Building',
          content: 'Go to the highest level (not the attic if you could become trapped). Signal for help from a window or roof. Call 111 if you can. Do not enter the attic unless you have an escape route to the roof.',
          icon: 'emergency'
        }
      ],
      after: [
        {
          id: 'flood-after-1',
          title: 'Return Home Safely',
          content: 'Return only when authorities say it is safe. Be cautious of damaged roads and bridges. Watch for debris and contaminated water. Check for structural damage before entering.',
          icon: 'home'
        },
        {
          id: 'flood-after-2',
          title: 'Clean and Disinfect',
          content: 'Everything touched by flood water should be cleaned and disinfected. Wear protective clothing during cleanup. Remove wet contents immediately to prevent mould. Document damage for insurance.',
          icon: 'cleaning_services'
        },
        {
          id: 'flood-after-3',
          title: 'Check Utilities',
          content: 'Have professionals check electrical systems before restoring power. Do not use gas appliances until checked for leaks. Do not drink tap water until authorities confirm it is safe.',
          icon: 'plumbing'
        },
        {
          id: 'flood-after-4',
          title: 'Health Precautions',
          content: 'Dispose of food that has come into contact with flood water. Watch for signs of mould growth. Seek medical attention if you have been in contact with flood water. Monitor for waterborne illnesses.',
          icon: 'health_and_safety'
        }
      ]
    },
    supplies: [
      'Drinking water (4L per person per day, 3+ days)',
      'Water purification tablets or filter',
      'Waterproof containers for documents',
      'Sandbags or flood barriers',
      'Wellington boots and waders',
      'Waterproof clothing',
      'Rope and life jackets',
      'Battery-powered radio',
      'Flashlights with extra batteries',
      'First aid kit',
      'Disinfectant and cleaning supplies',
      'Rubber gloves',
      'Wet/dry vacuum (for cleanup)',
      'Sump pump (if applicable)',
      'Important documents (copies in waterproof bag)'
    ],
    emergencyContacts: [
      { name: 'Emergency Services', number: '111', description: 'Fire, Police, Ambulance' },
      { name: 'Local Council', number: 'Check local listings', description: 'Flood warnings and information' }
    ]
  },
  {
    id: 'strong-winds-template',
    type: 'strong_winds',
    name: 'Strong Winds & Storm Emergency',
    description: 'Preparation and response guide for severe wind events, cyclones, and storms.',
    icon: 'air',
    color: 'from-slate-500 to-gray-700',
    sections: {
      before: [
        {
          id: 'wind-before-1',
          title: 'Secure Your Property',
          content: 'Trim trees and remove dead branches near your home. Secure outdoor furniture, trampolines, and loose items. Check roof tiles and cladding are secure. Install storm shutters if in high-risk area.',
          icon: 'home'
        },
        {
          id: 'wind-before-2',
          title: 'Identify Safe Rooms',
          content: 'Choose an interior room on the lowest floor away from windows. Reinforce garage doors if necessary. Know where to shelter at work, school, and other locations.',
          icon: 'meeting_room'
        },
        {
          id: 'wind-before-3',
          title: 'Prepare Emergency Kit',
          content: 'Include supplies for at least 3 days. Have tools for emergency repairs (tarps, plywood, nails). Keep important documents in waterproof container. Charge all devices before storm arrives.',
          icon: 'backpack'
        },
        {
          id: 'wind-before-4',
          title: 'Stay Informed',
          content: 'Monitor weather forecasts regularly. Know the difference between watches and warnings. Download weather alert apps. Sign up for local emergency notifications.',
          icon: 'notifications_active'
        }
      ],
      during: [
        {
          id: 'wind-during-1',
          title: 'Stay Indoors',
          content: 'Move away from windows, skylights, and glass doors. Close all interior doors. Stay in the safe room during the worst of the storm. Do not go outside during the eye of a cyclone.',
          icon: 'home'
        },
        {
          id: 'wind-during-2',
          title: 'If Caught Outside',
          content: 'Seek shelter in a sturdy building immediately. If no shelter available, lie flat in a ditch or low area. Protect your head with your arms. Stay away from trees and power lines.',
          icon: 'warning'
        },
        {
          id: 'wind-during-3',
          title: 'If Driving',
          content: 'Pull over safely away from trees and power lines. Stay in the vehicle with seatbelt fastened. Keep below window level if debris is flying. Do not drive through flooded roads.',
          icon: 'directions_car'
        },
        {
          id: 'wind-during-4',
          title: 'Power Outage Safety',
          content: 'Use flashlights instead of candles. Keep refrigerator and freezer doors closed. Disconnect appliances to prevent surge damage. Use generators outdoors only.',
          icon: 'power_off'
        }
      ],
      after: [
        {
          id: 'wind-after-1',
          title: 'Assess Damage Carefully',
          content: 'Check for structural damage before entering buildings. Watch for downed power lines and broken glass. Use extreme caution with chainsaws and equipment. Take photos for insurance.',
          icon: 'search'
        },
        {
          id: 'wind-after-2',
          title: 'Emergency Repairs',
          content: 'Cover damaged roofs with tarps to prevent water damage. Board up broken windows. Be cautious of unstable structures. Hire licensed contractors for major repairs.',
          icon: 'construction'
        },
        {
          id: 'wind-after-3',
          title: 'Stay Safe During Cleanup',
          content: 'Wear protective gear during cleanup. Be alert for animals that may have been displaced. Pace yourself to avoid exhaustion. Ask for help if needed.',
          icon: 'health_and_safety'
        },
        {
          id: 'wind-after-4',
          title: 'Check on Others',
          content: 'Check on neighbours, especially elderly and those with special needs. Share resources if you have excess. Report any hazards to authorities. Support community recovery efforts.',
          icon: 'volunteer_activism'
        }
      ]
    },
    supplies: [
      'Tarps and plastic sheeting',
      'Plywood boards',
      'Hammer and nails',
      'Duct tape and rope',
      'Battery-powered radio',
      'Flashlights and extra batteries',
      'First aid kit',
      'Non-perishable food (3+ days)',
      'Drinking water (4L per person per day)',
      'Manual can opener',
      'Phone chargers and power bank',
      'Cash in small denominations',
      'Work gloves',
      'Chainsaw and fuel (for cleanup)',
      'Generator and fuel (use outdoors only)'
    ],
    emergencyContacts: [
      { name: 'Emergency Services', number: '111', description: 'Fire, Police, Ambulance' },
      { name: 'MetService Weather', number: '0900 999 99', description: 'Weather forecasts' }
    ]
  },
  {
    id: 'earthquake-template',
    type: 'earthquake',
    name: 'Earthquake Emergency',
    description: 'Complete guide for earthquake preparedness, response, and recovery.',
    icon: 'vibration',
    color: 'from-amber-600 to-yellow-700',
    sections: {
      before: [
        {
          id: 'eq-before-1',
          title: 'Secure Your Space',
          content: 'Secure heavy furniture to walls. Store heavy items on lower shelves. Install latches on cabinets. Move beds away from windows. Identify safe spots in each room.',
          icon: 'home'
        },
        {
          id: 'eq-before-2',
          title: 'Create a Family Plan',
          content: 'Identify safe spots in every room (under sturdy furniture, against interior walls). Establish meeting points outside your home. Plan for how to communicate if separated. Know how to turn off utilities.',
          icon: 'family_restroom'
        },
        {
          id: 'eq-before-3',
          title: 'Prepare Emergency Supplies',
          content: 'Store supplies for at least 7 days (earthquakes can disrupt services longer). Keep supplies in multiple locations. Include tools to turn off utilities. Store sturdy shoes by your bed.',
          icon: 'inventory_2'
        },
        {
          id: 'eq-before-4',
          title: 'Know Your Building',
          content: 'Learn if your building is earthquake-strengthened. Know the safest exit routes. Identify areas to avoid (near glass, heavy objects). Practice Drop, Cover, and Hold regularly.',
          icon: 'apartment'
        }
      ],
      during: [
        {
          id: 'eq-during-1',
          title: 'DROP, COVER, and HOLD',
          content: 'DROP to your hands and knees. COVER your head and neck under sturdy furniture or against an interior wall. HOLD on until the shaking stops. This is the recommended action in most situations.',
          icon: 'pan_tool'
        },
        {
          id: 'eq-during-2',
          title: 'If Indoors',
          content: 'Stay inside. Do not run outside during shaking. Stay away from windows and exterior walls. Do not use elevators. If in bed, stay there and protect your head with a pillow.',
          icon: 'home'
        },
        {
          id: 'eq-during-3',
          title: 'If Outdoors',
          content: 'Stay outside. Move away from buildings, power lines, and trees. Drop to the ground in a clear area. Protect your head. Stay there until shaking stops.',
          icon: 'park'
        },
        {
          id: 'eq-during-4',
          title: 'If Driving',
          content: 'Pull over to a clear location safely. Stop and stay in the vehicle. Avoid bridges, overpasses, and power lines. Set parking brake. Wait until shaking stops before driving.',
          icon: 'directions_car'
        }
      ],
      after: [
        {
          id: 'eq-after-1',
          title: 'Expect Aftershocks',
          content: 'Aftershocks may be strong. Drop, Cover, and Hold during each one. Stay alert for hours to days after the main quake. Check yourself and others for injuries.',
          icon: 'warning'
        },
        {
          id: 'eq-after-2',
          title: 'Check for Hazards',
          content: 'Check for gas leaks (smell, do not use flames). Look for electrical damage. Check for structural damage. If unsafe, evacuate immediately. Check on neighbours.',
          icon: 'search'
        },
        {
          id: 'eq-after-3',
          title: 'Communicate',
          content: 'Text rather than call to keep lines clear. Register on Red Cross Safe and Well website. Use social media to update family. Follow official information channels.',
          icon: 'chat'
        },
        {
          id: 'eq-after-4',
          title: 'Tsunami Awareness',
          content: 'If near coast, move to high ground immediately after severe shaking. Do not wait for official warnings for local tsunamis. Stay away from coast until all-clear given. A natural warning is the earthquake itself.',
          icon: 'waves'
        }
      ]
    },
    supplies: [
      'Water (4L per person per day for 7 days)',
      'Non-perishable food (7 days)',
      'First aid kit',
      'Torch/flashlight with extra batteries',
      'Battery or crank radio',
      'Whistle for signaling',
      'Dust masks',
      'Sturdy shoes (keep by bed)',
      'Work gloves',
      'Wrench for turning off utilities',
      'Phone charger and power bank',
      'Cash in small denominations',
      'Copies of important documents',
      'Medications (7 day supply)',
      'Pet supplies if applicable'
    ],
    emergencyContacts: [
      { name: 'Emergency Services', number: '111', description: 'Fire, Police, Ambulance' },
      { name: 'GeoNet', number: 'geonet.org.nz', description: 'Earthquake information' },
      { name: 'Civil Defence', number: 'Check local listings', description: 'Emergency management' }
    ]
  },
  {
    id: 'tsunami-template',
    type: 'tsunami',
    name: 'Tsunami Emergency',
    description: 'Critical information for tsunami awareness, warning systems, and evacuation procedures.',
    icon: 'waves',
    color: 'from-teal-500 to-blue-700',
    sections: {
      before: [
        {
          id: 'tsunami-before-1',
          title: 'Know Your Risk',
          content: 'Learn if you live, work, or travel in a tsunami zone. Identify tsunami evacuation zones and routes. Know the height of your location above sea level. Recognize natural warning signs.',
          icon: 'map'
        },
        {
          id: 'tsunami-before-2',
          title: 'Learn Warning Signs',
          content: 'Strong or long earthquake (more than a minute). Unusual sea behavior: loud roar, sudden rise or fall, rapid retreat from shore. These are natural warnings - do not wait for official alerts.',
          icon: 'warning'
        },
        {
          id: 'tsunami-before-3',
          title: 'Plan Your Evacuation',
          content: 'Know routes to high ground or inland areas. Practice evacuation by foot (roads may be blocked). Aim for 30+ meters above sea level or 2+ km inland. Know evacuation routes from work and school too.',
          icon: 'route'
        },
        {
          id: 'tsunami-before-4',
          title: 'Prepare Go Bag',
          content: 'Keep a grab bag ready with essentials. Include water, snacks, medications, torch, radio. Store in an easy-to-reach location. Practice grabbing it during drills.',
          icon: 'backpack'
        }
      ],
      during: [
        {
          id: 'tsunami-during-1',
          title: 'Long or Strong, Get Gone',
          content: 'If earthquake shaking is longer than a minute or strong enough to knock you down, a local tsunami may arrive within minutes. Do not wait for official warnings - evacuate immediately on foot.',
          icon: 'directions_run'
        },
        {
          id: 'tsunami-during-2',
          title: 'Move Immediately to High Ground',
          content: 'Go on foot if possible - roads will be congested. Head for high ground (30m+) or inland (2km+). If you cannot get to high ground, go to an upper floor (3rd+) of a sturdy concrete building. Keep moving inland.',
          icon: 'terrain'
        },
        {
          id: 'tsunami-during-3',
          title: 'If Caught in Water',
          content: 'Grab onto something that floats. Do not try to swim - the current is too strong. Avoid debris in the water. Get to safety as soon as possible.',
          icon: 'water'
        },
        {
          id: 'tsunami-during-4',
          title: 'Stay Safe',
          content: 'Stay away from the coast until officials give all-clear. Tsunamis come in waves - the first may not be the largest. Waves can continue for hours. Do not return to low-lying areas.',
          icon: 'shield'
        }
      ],
      after: [
        {
          id: 'tsunami-after-1',
          title: 'Wait for All-Clear',
          content: 'Stay at high ground until authorities say it is safe. Listen to official channels for information. The danger may continue for many hours. Do not assume it is over after one wave.',
          icon: 'access_time'
        },
        {
          id: 'tsunami-after-2',
          title: 'Return Carefully',
          content: 'Return only when authorities confirm it is safe. Be aware of damaged roads, bridges, and infrastructure. Watch for debris and hazardous materials. Do not touch downed power lines.',
          icon: 'warning'
        },
        {
          id: 'tsunami-after-3',
          title: 'Health Precautions',
          content: 'Do not drink tap water until declared safe. Avoid flood water which may be contaminated. Clean and disinfect everything that got wet. Watch for injuries and seek medical help.',
          icon: 'health_and_safety'
        },
        {
          id: 'tsunami-after-4',
          title: 'Document and Report',
          content: 'Document damage for insurance. Report hazards to authorities. Check on neighbours, especially vulnerable people. Access community support services.',
          icon: 'description'
        }
      ]
    },
    supplies: [
      'Go bag always ready by door',
      'Comfortable walking shoes',
      'Water bottle',
      'Energy bars/snacks',
      'Torch/flashlight',
      'Battery or crank radio',
      'Phone and charger',
      'Cash',
      'First aid basics',
      'Medications',
      'Warm clothing/rain jacket',
      'Whistle',
      'Important documents (copies)',
      'Child/pet carriers if needed',
      'Sunscreen and hat'
    ],
    emergencyContacts: [
      { name: 'Emergency Services', number: '111', description: 'Fire, Police, Ambulance' },
      { name: 'National Emergency Management Agency', number: 'civildefence.govt.nz', description: 'Tsunami warnings' }
    ]
  },
  {
    id: 'snow-template',
    type: 'snow',
    name: 'Snow & Ice Emergency',
    description: 'Guide for preparing and responding to severe winter weather, snow storms, and ice events.',
    icon: 'ac_unit',
    color: 'from-sky-400 to-indigo-500',
    sections: {
      before: [
        {
          id: 'snow-before-1',
          title: 'Winterize Your Home',
          content: 'Insulate pipes to prevent freezing. Service heating systems before winter. Stock up on heating fuel. Clear gutters and check roof condition. Install weather stripping on doors and windows.',
          icon: 'home'
        },
        {
          id: 'snow-before-2',
          title: 'Prepare Your Vehicle',
          content: 'Install winter tyres or carry chains. Keep fuel tank at least half full. Carry emergency kit in vehicle. Check antifreeze levels. Ensure wipers and defrosters work properly.',
          icon: 'directions_car'
        },
        {
          id: 'snow-before-3',
          title: 'Stock Emergency Supplies',
          content: 'Store food and water for at least 3 days. Have backup heating source (safely vented). Stock medications and first aid supplies. Keep rock salt or sand for ice. Have extra blankets.',
          icon: 'inventory_2'
        },
        {
          id: 'snow-before-4',
          title: 'Plan for Power Outages',
          content: 'Have alternative heating plans. Know how to prevent pipes from freezing. Stock batteries for radios and flashlights. Consider generator (use outdoors only). Charge devices fully before storms.',
          icon: 'power'
        }
      ],
      during: [
        {
          id: 'snow-during-1',
          title: 'Stay Indoors',
          content: 'Avoid unnecessary travel. If you must go out, tell someone your route and expected arrival. Dress in layers with waterproof outer layer. Cover extremities to prevent frostbite.',
          icon: 'home'
        },
        {
          id: 'snow-during-2',
          title: 'Keep Warm Safely',
          content: 'Never use outdoor heaters or grills indoors. Keep space heaters away from flammables. Do not leave heating devices unattended. Watch for signs of carbon monoxide poisoning.',
          icon: 'whatshot'
        },
        {
          id: 'snow-during-3',
          title: 'If Stranded in Vehicle',
          content: 'Stay with your vehicle. Run engine for heat periodically, ensuring exhaust pipe is clear of snow. Use bright cloth on antenna as signal. Keep one window slightly open. Move around to stay warm.',
          icon: 'directions_car'
        },
        {
          id: 'snow-during-4',
          title: 'Prevent Frozen Pipes',
          content: 'Keep heat on at least 13°C (55°F). Open cabinet doors under sinks. Let faucets drip slightly. Know how to shut off water main. Insulate exposed pipes.',
          icon: 'plumbing'
        }
      ],
      after: [
        {
          id: 'snow-after-1',
          title: 'Clear Snow Safely',
          content: 'Take breaks when shoveling - avoid overexertion. Push snow rather than lifting when possible. Stay hydrated. Watch for ice underneath snow. Clear snow from vents and meters.',
          icon: 'fitness_center'
        },
        {
          id: 'snow-after-2',
          title: 'Check Property',
          content: 'Look for ice dams on roof. Check for frozen pipes. Remove heavy snow from roofs if safe. Watch for tree limbs weighted by snow. Clear paths for emergency access.',
          icon: 'home'
        },
        {
          id: 'snow-after-3',
          title: 'Drive Carefully',
          content: 'Allow extra travel time. Clear all snow and ice from vehicle before driving. Watch for black ice. Increase following distance. Brake gently to avoid skidding.',
          icon: 'directions_car'
        },
        {
          id: 'snow-after-4',
          title: 'Check on Others',
          content: 'Check on elderly neighbours. Help clear paths for those who cannot. Share resources if able. Watch for signs of hypothermia or frostbite in others.',
          icon: 'volunteer_activism'
        }
      ]
    },
    supplies: [
      'Extra blankets and warm clothing',
      'Rock salt or sand for ice',
      'Snow shovel and ice scraper',
      'Winter tyres or chains',
      'Portable heater (safe for indoors)',
      'Extra heating fuel',
      'Pipe insulation',
      'Carbon monoxide detector',
      'Non-perishable food (3+ days)',
      'Bottled water',
      'Flashlights and batteries',
      'Battery-powered radio',
      'First aid kit',
      'Medications',
      'Jumper cables'
    ],
    emergencyContacts: [
      { name: 'Emergency Services', number: '111', description: 'Fire, Police, Ambulance' },
      { name: 'Road Conditions', number: '0800 44 44 49', description: 'NZTA road information' }
    ]
  },
  {
    id: 'pandemic-template',
    type: 'pandemic',
    name: 'Pandemic & Health Emergency',
    description: 'Comprehensive guide for preparing and responding to infectious disease outbreaks and pandemics.',
    icon: 'coronavirus',
    color: 'from-green-500 to-emerald-700',
    sections: {
      before: [
        {
          id: 'pandemic-before-1',
          title: 'Stock Essential Supplies',
          content: 'Maintain 2-4 weeks of non-perishable food. Keep prescription medications stocked (consult doctor for extended supply). Stock hygiene supplies: soap, hand sanitiser, tissues. Have thermometer and basic medical supplies.',
          icon: 'inventory_2'
        },
        {
          id: 'pandemic-before-2',
          title: 'Plan for Disruptions',
          content: 'Plan for potential school and workplace closures. Arrange backup childcare if needed. Consider how to work from home. Ensure you can pay bills online. Stock entertainment for extended home time.',
          icon: 'event_note'
        },
        {
          id: 'pandemic-before-3',
          title: 'Stay Informed',
          content: 'Follow reliable health authority sources. Learn symptoms of the disease. Understand how it spreads. Know how to access testing. Know when to seek medical care.',
          icon: 'info'
        },
        {
          id: 'pandemic-before-4',
          title: 'Practice Good Hygiene',
          content: 'Wash hands frequently for 20+ seconds. Avoid touching face. Keep commonly touched surfaces clean. Stay up to date with vaccinations. Practice cough and sneeze etiquette.',
          icon: 'clean_hands'
        }
      ],
      during: [
        {
          id: 'pandemic-during-1',
          title: 'Follow Health Guidelines',
          content: 'Follow official health advice and restrictions. Practice social distancing as recommended. Wear masks when required. Avoid large gatherings. Stay informed about local case levels.',
          icon: 'health_and_safety'
        },
        {
          id: 'pandemic-during-2',
          title: 'Protect Yourself and Others',
          content: 'Stay home if feeling unwell. Get tested if you have symptoms. Self-isolate if required. Notify close contacts if you test positive. Monitor symptoms and seek help if severe.',
          icon: 'shield'
        },
        {
          id: 'pandemic-during-3',
          title: 'Care for Sick Family Members',
          content: 'Isolate sick person in separate room if possible. Use separate bathroom if available. Wear gloves and mask when caring for them. Disinfect frequently touched surfaces. Monitor symptoms closely.',
          icon: 'personal_injury'
        },
        {
          id: 'pandemic-during-4',
          title: 'Maintain Mental Health',
          content: 'Stay connected with friends and family remotely. Maintain routines where possible. Exercise regularly. Limit news consumption to reliable sources at set times. Seek help if struggling.',
          icon: 'psychology'
        }
      ],
      after: [
        {
          id: 'pandemic-after-1',
          title: 'Continue Precautions',
          content: 'Follow guidance on easing restrictions. Continue good hygiene practices. Stay up to date with vaccinations. Monitor for new variants or waves. Rebuild social connections safely.',
          icon: 'healing'
        },
        {
          id: 'pandemic-after-2',
          title: 'Restore Normal Activities',
          content: 'Gradually return to normal activities per guidelines. Continue monitoring health. Support local businesses. Reconnect with community. Maintain emergency supplies for future events.',
          icon: 'groups'
        },
        {
          id: 'pandemic-after-3',
          title: 'Address Health Impacts',
          content: 'Seek care for any ongoing health issues. Address mental health impacts. Catch up on delayed medical care. Support vulnerable community members.',
          icon: 'medical_services'
        },
        {
          id: 'pandemic-after-4',
          title: 'Learn and Prepare',
          content: 'Document lessons learned. Update emergency plans based on experience. Maintain stockpiles of supplies. Support community resilience initiatives.',
          icon: 'school'
        }
      ]
    },
    supplies: [
      'Face masks (disposable and/or reusable)',
      'Hand sanitiser (60%+ alcohol)',
      'Disinfectant wipes and sprays',
      'Soap (bar and liquid)',
      'Tissues',
      'Thermometer',
      'Disposable gloves',
      'Paracetamol/pain relievers',
      'Prescription medications (extended supply)',
      'Non-perishable food (2-4 weeks)',
      'Drinking water',
      'Household cleaning supplies',
      'Rubbish bags',
      'Basic first aid supplies',
      'Entertainment/activities for home'
    ],
    emergencyContacts: [
      { name: 'Emergency Services', number: '111', description: 'Medical emergencies' },
      { name: 'Healthline', number: '0800 611 116', description: 'Health advice 24/7' },
      { name: 'Ministry of Health', number: 'health.govt.nz', description: 'Official health information' }
    ]
  },
  {
    id: 'solar-storm-template',
    type: 'solar_storm',
    name: 'Solar Storm & Geomagnetic Event',
    description: 'Preparation guide for severe space weather events that may affect power grids and communications.',
    icon: 'wb_sunny',
    color: 'from-yellow-400 to-orange-600',
    sections: {
      before: [
        {
          id: 'solar-before-1',
          title: 'Understand the Risk',
          content: 'Solar storms can damage power grids and satellites. Effects can last days to weeks. Communication systems may be disrupted. GPS navigation may be unreliable. Aurora may be visible at unusual latitudes.',
          icon: 'info'
        },
        {
          id: 'solar-before-2',
          title: 'Prepare for Extended Power Outages',
          content: 'Stock supplies for at least 2 weeks without power. Have cash on hand (ATMs may not work). Stock non-perishable food. Fill vehicle fuel tanks. Arrange backup power if possible.',
          icon: 'power_off'
        },
        {
          id: 'solar-before-3',
          title: 'Protect Electronics',
          content: 'Keep spare electronics in Faraday cage or metal container. Unplug sensitive electronics during severe events. Have battery-powered or hand-crank radio. Keep printed copies of important information.',
          icon: 'devices'
        },
        {
          id: 'solar-before-4',
          title: 'Communication Plan',
          content: 'Establish meeting points with family if communications fail. Know how to reach family without phones. Have AM/FM radio for emergency broadcasts. Consider ham radio for long-range communication.',
          icon: 'chat'
        }
      ],
      during: [
        {
          id: 'solar-during-1',
          title: 'Unplug and Protect',
          content: 'Unplug sensitive electronics from wall outlets. Use surge protectors on essential equipment. Avoid using corded phones during storm. Monitor space weather alerts if communications working.',
          icon: 'power'
        },
        {
          id: 'solar-during-2',
          title: 'Prepare for Outages',
          content: 'If power goes out, prepare for extended outage. Conserve device batteries. Use refrigerator and freezer sparingly. Use backup lighting and heating safely.',
          icon: 'flashlight_on'
        },
        {
          id: 'solar-during-3',
          title: 'Travel Considerations',
          content: 'GPS may be unreliable - carry paper maps. Flights may be rerouted or delayed. Traffic signals may not work. Avoid unnecessary travel until impacts are known.',
          icon: 'map'
        },
        {
          id: 'solar-during-4',
          title: 'Health Effects',
          content: 'Solar storms pose no direct health risk at ground level. Airline passengers and crew may have increased radiation exposure. Astronauts are at highest risk. No special health precautions needed for most people.',
          icon: 'health_and_safety'
        }
      ],
      after: [
        {
          id: 'solar-after-1',
          title: 'Assess Damage',
          content: 'Check electronics and appliances before use. Report power outages to utility company. Check for damage to communication equipment. Document any damage for insurance.',
          icon: 'search'
        },
        {
          id: 'solar-after-2',
          title: 'Restore Power Safely',
          content: 'Wait for utility confirmation before assuming power is stable. Use surge protectors when plugging in devices. Check sensitive equipment carefully. Be patient - grid repairs may take time.',
          icon: 'power'
        },
        {
          id: 'solar-after-3',
          title: 'Communication Recovery',
          content: 'Communication systems may recover gradually. Cell networks may be congested. Check on family and neighbours. Monitor official channels for updates.',
          icon: 'signal_cellular_alt'
        },
        {
          id: 'solar-after-4',
          title: 'Learn and Prepare',
          content: 'Consider improvements to your preparedness. Install whole-house surge protectors. Maintain emergency supplies. Stay informed about space weather.',
          icon: 'school'
        }
      ]
    },
    supplies: [
      'Battery-powered or crank radio (AM/FM)',
      'Flashlights with extra batteries',
      'Candles and matches (use safely)',
      'Non-perishable food (2+ weeks)',
      'Drinking water (4L per person per day)',
      'Manual can opener',
      'Cash in small denominations',
      'Paper maps of local area',
      'Faraday bag or metal container for electronics',
      'Surge protectors',
      'Spare batteries for essential devices',
      'Printed copies of important contacts',
      'First aid kit',
      'Medications (2 week supply)',
      'Portable power bank (charged)'
    ],
    emergencyContacts: [
      { name: 'Emergency Services', number: '111', description: 'Fire, Police, Ambulance' },
      { name: 'Power Company', number: 'Check your bill', description: 'Report outages' },
      { name: 'NOAA Space Weather', number: 'spaceweather.gov', description: 'Space weather forecasts' }
    ]
  },
  {
    id: 'invasion-template',
    type: 'invasion',
    name: 'Outside Invasion & Security Emergency',
    description: 'Critical guide for community protection during armed conflict, hostile incursions, or raider attacks during extreme events.',
    icon: 'shield',
    color: 'from-red-700 to-slate-800',
    sections: {
      before: [
        {
          id: 'invasion-before-1',
          title: 'Establish Community Security',
          content: 'Form a community security team with designated roles. Establish communication protocols and check-in schedules. Identify trusted neighbours and create mutual aid agreements. Map your community boundaries and identify vulnerable entry points.',
          icon: 'groups'
        },
        {
          id: 'invasion-before-2',
          title: 'Fortify Your Home',
          content: 'Reinforce doors with deadbolts and door bars. Secure windows with locks and consider security film. Create a safe room in an interior space with no windows. Store emergency supplies in multiple hidden locations. Remove exterior lighting that silhouettes occupants.',
          icon: 'home'
        },
        {
          id: 'invasion-before-3',
          title: 'Establish Communication Systems',
          content: 'Set up radio communication (CB, FRS, or ham radio) that does not rely on cell networks. Create code words for different threat levels. Establish a community alert system (horns, bells, lights). Plan for communication blackouts.',
          icon: 'settings_input_antenna'
        },
        {
          id: 'invasion-before-4',
          title: 'Create Evacuation and Hiding Plans',
          content: 'Identify multiple evacuation routes away from main roads. Locate hiding spots both in your home and community. Prepare go-bags with essentials for rapid departure. Establish rally points for separated family members. Know locations of nearby communities that may offer refuge.',
          icon: 'route'
        },
        {
          id: 'invasion-before-5',
          title: 'Secure Essential Resources',
          content: 'Store food and water in hidden, distributed locations. Protect fuel supplies. Secure medical supplies and medications. Have backup power sources. Consider what resources might make you a target and plan accordingly.',
          icon: 'inventory_2'
        }
      ],
      during: [
        {
          id: 'invasion-during-1',
          title: 'Implement Security Protocols',
          content: 'Activate community alert system immediately. Move to safe room or evacuation point as situation dictates. Maintain radio silence unless necessary. Follow pre-established roles and protocols. Keep children calm and quiet.',
          icon: 'security'
        },
        {
          id: 'invasion-during-2',
          title: 'Assess and Respond to Threats',
          content: 'Gather intelligence before acting. Avoid confrontation when possible - your goal is survival. If approached, remain calm and non-threatening. Do not reveal location of others, supplies, or valuables. Follow instructions from community security team.',
          icon: 'visibility'
        },
        {
          id: 'invasion-during-3',
          title: 'If Evacuation Is Required',
          content: 'Leave immediately via pre-planned routes. Travel light - take go-bag only. Avoid main roads and predictable paths. Move during low-visibility conditions when possible. Stay together as a group for safety.',
          icon: 'directions_run'
        },
        {
          id: 'invasion-during-4',
          title: 'If Sheltering In Place',
          content: 'Stay away from windows and exterior walls. Keep lights off or blacked out. Remain quiet and limit movement. Have supplies accessible without leaving safe area. Monitor communications for updates.',
          icon: 'shield'
        },
        {
          id: 'invasion-during-5',
          title: 'Protect Vulnerable Members',
          content: 'Prioritise safety of children, elderly, and disabled. Keep them in safest location. Assign guardians to vulnerable individuals. Have medication and special needs supplies ready. Maintain calm to prevent panic.',
          icon: 'family_restroom'
        }
      ],
      after: [
        {
          id: 'invasion-after-1',
          title: 'Verify Safety Before Emerging',
          content: 'Wait for all-clear signal from trusted sources. Scout the area carefully before moving freely. Check on all community members. Assess damage to property and resources. Re-establish communication with broader network.',
          icon: 'search'
        },
        {
          id: 'invasion-after-2',
          title: 'Account for All Community Members',
          content: 'Conduct headcount of all residents. Search for missing persons. Document injuries and provide first aid. Identify anyone who needs evacuation for medical care. Support those experiencing trauma.',
          icon: 'people'
        },
        {
          id: 'invasion-after-3',
          title: 'Secure Resources and Property',
          content: 'Assess and document losses. Secure remaining supplies. Repair defensive measures. Redistribute resources if some families suffered losses. Plan for potential follow-up incidents.',
          icon: 'lock'
        },
        {
          id: 'invasion-after-4',
          title: 'Strengthen Community Resilience',
          content: 'Review what worked and what needs improvement. Update security protocols based on lessons learned. Strengthen relationships with neighbouring communities. Consider long-term sustainability and protection strategies.',
          icon: 'engineering'
        },
        {
          id: 'invasion-after-5',
          title: 'Address Psychological Impact',
          content: 'Recognise trauma responses in adults and children. Create space for community members to process experiences. Watch for signs of PTSD and provide support. Maintain routines to restore sense of normalcy. Seek professional help when available.',
          icon: 'psychology'
        }
      ]
    },
    supplies: [
      'Two-way radios (multiple sets with spare batteries)',
      'First aid kit (trauma-rated with tourniquets, bandages)',
      'Defensive tools (flashlights, whistles, personal alarms)',
      'Door reinforcement bars and window locks',
      'Blackout curtains or materials',
      'Go-bags for each family member',
      'Water (4L per person per day, 2+ weeks)',
      'Non-perishable food (2+ weeks, easily hidden)',
      'Medications and medical supplies',
      'Sturdy footwear for rapid movement',
      'Warm clothing and rain gear',
      'Maps of local area and region',
      'Cash in small denominations',
      'Important documents (copies in waterproof bag)',
      'Fire extinguisher',
      'Tools for barricading (hammer, nails, boards)',
      'Portable water filter',
      'Solar charger or hand-crank devices',
      'Whistle and signaling mirror',
      'Rope and cordage'
    ],
    emergencyContacts: [
      { name: 'Emergency Services', number: '111', description: 'Police, Fire, Ambulance (if available)' },
      { name: 'Community Security Team', number: 'Radio Channel', description: 'Pre-established frequency' },
      { name: 'Neighbouring Community', number: 'Radio Channel', description: 'Mutual aid network' },
      { name: 'Civil Defence', number: 'Check local listings', description: 'Emergency coordination' }
    ]
  }
]

// Helper function to get template by type
export function getTemplateByType(type: DisasterType): GuideTemplate | undefined {
  return guideTemplates.find(template => template.type === type)
}

// Helper function to get all template types
export function getAllDisasterTypes(): DisasterType[] {
  return guideTemplates.map(template => template.type)
}

// Helper function to get display name for disaster type
export function getDisasterTypeName(type: DisasterType): string {
  const names: Record<DisasterType, string> = {
    fire: 'Fire',
    flood: 'Flood',
    strong_winds: 'Strong Winds',
    earthquake: 'Earthquake',
    tsunami: 'Tsunami',
    snow: 'Snow & Ice',
    pandemic: 'Pandemic',
    solar_storm: 'Solar Storm',
    invasion: 'Outside Invasion'
  }
  return names[type]
}
