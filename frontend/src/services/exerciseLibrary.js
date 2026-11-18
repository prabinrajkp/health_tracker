// The activities a workout can be logged as, with their METs (Normal and Hard effort).
// Calories always come from these and the user's weight, never from the AI, which
// only maps a name to an entry here. See docs/workout_logging_plan.md.
//
// METs follow the Adult Compendium of Physical Activities. Lifts share the
// Compendium's resistance-training values: it does not separate bench press from
// squats, and one value per lift would be false precision.
//
// kind:    strength (sets, reps, kg; time from sets)  · session (a whole gym session)
//          cardio (time or distance)  · steps (walking, running, hiking, stairs: also
//          counted by the step counter)  · sport  · flexibility
// legacy:  the old six-type label, kept so badges, insights and exports still read it
// kmh:     typical speed, to turn a distance into minutes
// cadence: steps a minute, to take out what the step counter already counted

const S = (id, name, aliases, normal = 5.0, hard = 6.0) =>
  ({ id, name, kind: 'strength', aliases, mets: { normal, hard }, legacy: 'Gym' })

export const EXERCISES = [
  // ── A whole session ──
  { id: 'gym', name: 'Gym session', kind: 'session', aliases: ['gym', 'workout', 'weights', 'weight training', 'lifting', 'strength training', 'resistance training'], mets: { normal: 5.0, hard: 6.0 }, legacy: 'Gym' },
  { id: 'circuit', name: 'Circuit training', kind: 'session', aliases: ['circuit', 'circuits', 'hiit', 'crossfit', 'bootcamp', 'functional training'], mets: { normal: 4.3, hard: 8.0 }, legacy: 'Gym' },
  { id: 'calisthenics', name: 'Bodyweight workout', kind: 'session', aliases: ['calisthenics', 'bodyweight', 'home workout'], mets: { normal: 3.8, hard: 8.0 }, legacy: 'Gym' },

  // ── Lifts and bodyweight exercises: time from sets ──
  S('bench_press', 'Bench press', ['bench', 'bp', 'flat bench', 'chest press', 'barbell bench']),
  S('incline_press', 'Incline press', ['incline bench', 'incline db', 'incline dumbbell press', 'incline press']),
  S('dumbbell_press', 'Dumbbell press', ['db press', 'dumbbell bench', 'db bench']),
  S('chest_fly', 'Chest fly', ['fly', 'flys', 'flyes', 'db flys', 'pec deck', 'cable fly', 'cable crossover']),
  S('push_up', 'Push-ups', ['pushup', 'pushups', 'push ups', 'press up', 'press ups'], 3.8, 8.0),
  S('dips', 'Dips', ['dip', 'tricep dips'], 3.8, 8.0),
  S('overhead_press', 'Shoulder press', ['ohp', 'overhead press', 'military press', 'shoulder press', 'db shoulder press']),
  S('lateral_raise', 'Lateral raise', ['lateral raises', 'side raise', 'side raises', 'lat raise']),
  S('front_raise', 'Front raise', ['front raises']),
  S('shrug', 'Shrugs', ['shrug', 'shrugs']),
  S('pull_up', 'Pull-ups', ['pullup', 'pullups', 'pull ups', 'chin up', 'chin ups', 'chinups'], 3.8, 8.0),
  S('lat_pulldown', 'Lat pulldown', ['pulldown', 'lat pull down', 'lat pulldowns']),
  S('row', 'Row', ['rows', 'barbell row', 'bent over row', 'db row', 'dumbbell row', 'seated row', 'cable row', 't bar row']),
  S('deadlift', 'Deadlift', ['deadlifts', 'dl', 'rdl', 'romanian deadlift']),
  S('squat', 'Squat', ['squats', 'back squat', 'front squat', 'goblet squat']),
  S('leg_press', 'Leg press', ['legpress']),
  S('lunge', 'Lunges', ['lunge', 'walking lunges', 'split squat', 'bulgarian split squat']),
  S('leg_extension', 'Leg extension', ['leg extensions', 'quad extension']),
  S('leg_curl', 'Leg curl', ['leg curls', 'hamstring curl']),
  S('calf_raise', 'Calf raise', ['calf raises', 'calves']),
  S('hip_thrust', 'Hip thrust', ['hip thrusts', 'glute bridge', 'glute bridges']),
  S('bicep_curl', 'Biceps curl', ['curl', 'curls', 'bicep curl', 'bicep curls', 'biceps curls', 'hammer curl', 'hammer curls', 'preacher curl']),
  S('tricep_extension', 'Triceps extension', ['tricep extension', 'triceps pushdown', 'tricep pushdown', 'pushdown', 'skull crusher', 'skullcrushers', 'overhead extension']),
  S('crunch', 'Crunches', ['crunch', 'situps', 'sit ups', 'sit-ups', 'ab crunch', 'abs'], 3.8, 8.0),
  S('plank', 'Plank', ['planks', 'side plank'], 3.8, 8.0),
  S('leg_raise', 'Leg raise', ['leg raises', 'hanging leg raise']),
  S('kettlebell', 'Kettlebell swing', ['kettlebell', 'kb swing', 'kettlebell swings'], 6.0, 9.8),
  S('burpee', 'Burpees', ['burpee'], 8.0, 8.0),

  // ── Steps: also counted by the step counter ──
  { id: 'walking', name: 'Walking', kind: 'steps', aliases: ['walk', 'walked', 'brisk walk', 'evening walk', 'morning walk'], mets: { normal: 3.8, hard: 4.8 }, legacy: 'Walking', kmh: 4.8, cadence: 110 },
  { id: 'running', name: 'Running', kind: 'steps', aliases: ['run', 'ran', 'jog', 'jogging', 'running', '5k', '10k'], mets: { normal: 8.3, hard: 11.0 }, legacy: 'Other', kmh: 9.5, cadence: 160 },
  { id: 'hiking', name: 'Hiking', kind: 'steps', aliases: ['hike', 'trek', 'trekking'], mets: { normal: 5.3, hard: 7.8 }, legacy: 'Walking', kmh: 4.0, cadence: 100 },
  { id: 'stairs', name: 'Stairs', kind: 'steps', aliases: ['stair', 'stair climbing', 'stairs climbing', 'steps climbing'], mets: { normal: 6.8, hard: 9.3 }, legacy: 'Stairs', cadence: 90 },

  // ── Cardio ──
  { id: 'cycling', name: 'Cycling', kind: 'cardio', aliases: ['cycle', 'bike', 'biking', 'bicycle', 'ride'], mets: { normal: 6.8, hard: 8.0 }, legacy: 'Cycling', kmh: 18 },
  { id: 'cycling_indoor', name: 'Indoor cycling', kind: 'cardio', aliases: ['spin', 'spinning', 'spin class', 'stationary bike', 'exercise bike', 'static cycle'], mets: { normal: 6.8, hard: 8.8 }, legacy: 'Cycling' },
  { id: 'treadmill', name: 'Treadmill', kind: 'cardio', aliases: ['treadmill walk', 'treadmill run'], mets: { normal: 4.8, hard: 8.3 }, legacy: 'Other', kmh: 6.5 },
  { id: 'elliptical', name: 'Elliptical', kind: 'cardio', aliases: ['cross trainer', 'crosstrainer', 'elliptical trainer'], mets: { normal: 5.0, hard: 6.8 }, legacy: 'Other' },
  { id: 'rowing', name: 'Rowing machine', kind: 'cardio', aliases: ['rower', 'rowing', 'erg', 'ergometer'], mets: { normal: 7.0, hard: 8.5 }, legacy: 'Other', kmh: 12 },
  { id: 'stair_machine', name: 'Stair machine', kind: 'cardio', aliases: ['stairmaster', 'stair master', 'stepper', 'step machine'], mets: { normal: 9.0, hard: 9.0 }, legacy: 'Stairs' },
  { id: 'skipping', name: 'Skipping rope', kind: 'cardio', aliases: ['skipping', 'jump rope', 'rope skipping', 'jumping rope'], mets: { normal: 8.8, hard: 11.8 }, legacy: 'Other' },
  { id: 'swimming', name: 'Swimming', kind: 'cardio', aliases: ['swim', 'swam', 'laps', 'freestyle'], mets: { normal: 5.8, hard: 9.8 }, legacy: 'Other', kmh: 2.5 },
  { id: 'aerobics', name: 'Aerobics', kind: 'cardio', aliases: ['aerobic', 'step aerobics'], mets: { normal: 5.0, hard: 7.3 }, legacy: 'Other' },
  { id: 'zumba', name: 'Zumba', kind: 'cardio', aliases: ['dance fitness'], mets: { normal: 5.5, hard: 6.5 }, legacy: 'Other' },
  { id: 'dancing', name: 'Dancing', kind: 'cardio', aliases: ['dance', 'bhangra', 'garba'], mets: { normal: 5.0, hard: 7.8 }, legacy: 'Other' },
  { id: 'boxing', name: 'Boxing', kind: 'cardio', aliases: ['punching bag', 'bag work', 'kickboxing', 'sparring'], mets: { normal: 5.5, hard: 7.8 }, legacy: 'Other' },
  { id: 'martial_arts', name: 'Martial arts', kind: 'sport', aliases: ['karate', 'taekwondo', 'judo', 'kung fu', 'mma', 'kalaripayattu'], mets: { normal: 5.3, hard: 10.3 }, legacy: 'Other' },

  // ── Sport ──
  { id: 'badminton', name: 'Badminton', kind: 'sport', aliases: ['shuttle', 'shuttlecock'], mets: { normal: 5.5, hard: 7.0 }, legacy: 'Badminton' },
  { id: 'football', name: 'Football', kind: 'sport', aliases: ['soccer', 'futsal'], mets: { normal: 7.0, hard: 10.0 }, legacy: 'Other' },
  { id: 'cricket', name: 'Cricket', kind: 'sport', aliases: ['batting', 'bowling practice', 'nets'], mets: { normal: 4.8, hard: 6.0 }, legacy: 'Other' },
  { id: 'basketball', name: 'Basketball', kind: 'sport', aliases: ['hoops'], mets: { normal: 6.5, hard: 8.0 }, legacy: 'Other' },
  { id: 'volleyball', name: 'Volleyball', kind: 'sport', aliases: ['beach volleyball'], mets: { normal: 4.0, hard: 6.0 }, legacy: 'Other' },
  { id: 'tennis', name: 'Tennis', kind: 'sport', aliases: ['lawn tennis'], mets: { normal: 6.0, hard: 8.0 }, legacy: 'Other' },
  { id: 'table_tennis', name: 'Table tennis', kind: 'sport', aliases: ['ping pong', 'tt'], mets: { normal: 4.0, hard: 5.5 }, legacy: 'Other' },
  { id: 'squash', name: 'Squash', kind: 'sport', aliases: [], mets: { normal: 7.3, hard: 12.0 }, legacy: 'Other' },
  { id: 'hockey', name: 'Hockey', kind: 'sport', aliases: ['field hockey'], mets: { normal: 7.8, hard: 10.0 }, legacy: 'Other' },
  { id: 'kabaddi', name: 'Kabaddi', kind: 'sport', aliases: ['kho kho'], mets: { normal: 6.0, hard: 8.0 }, legacy: 'Other' },
  { id: 'pickleball', name: 'Pickleball', kind: 'sport', aliases: [], mets: { normal: 4.5, hard: 6.0 }, legacy: 'Other' },

  // ── Flexibility and calm ──
  { id: 'yoga', name: 'Yoga', kind: 'flexibility', aliases: ['hatha yoga', 'asanas', 'surya namaskar', 'sun salutations'], mets: { normal: 2.5, hard: 4.0 }, legacy: 'Other' },
  { id: 'power_yoga', name: 'Power yoga', kind: 'flexibility', aliases: ['vinyasa', 'ashtanga'], mets: { normal: 4.0, hard: 4.0 }, legacy: 'Other' },
  { id: 'pilates', name: 'Pilates', kind: 'flexibility', aliases: ['mat pilates', 'reformer'], mets: { normal: 3.0, hard: 3.8 }, legacy: 'Other' },
  { id: 'stretching', name: 'Stretching', kind: 'flexibility', aliases: ['stretch', 'mobility', 'cool down', 'warm up', 'warmup'], mets: { normal: 2.3, hard: 2.3 }, legacy: 'Other' },

  // ── Anything else ──
  { id: 'other', name: 'Other exercise', kind: 'cardio', aliases: ['other', 'exercise', 'activity', 'sports'], mets: { normal: 5.0, hard: 6.0 }, legacy: 'Other' },
]

export const EXERCISE_BY_ID = Object.fromEntries(EXERCISES.map(e => [e.id, e]))

// The six old types, for days logged before the list existed
export const LEGACY_TO_ID = { Gym: 'gym', Walking: 'walking', Cycling: 'cycling', Badminton: 'badminton', Stairs: 'stairs', Other: 'other' }

// The quick-add choices on the Move screen, in the order most people need them
export const QUICK_ADD = ['gym', 'walking', 'running', 'cycling', 'badminton', 'yoga', 'swimming', 'other']
