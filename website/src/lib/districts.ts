/**
 * Districts, towns (krong) and Phnom Penh sections (khan) of each province, in
 * the usual English spelling: suggestions for the Join form's district box
 * (any other spelling can still be typed). Same list as CC Livestock's
 * src/lib/website/districts.ts; a test there checks the two stay equal.
 */
export const DISTRICTS: Readonly<Record<string, readonly string[]>> = {
  'Banteay Meanchey': ['Malai', 'Mongkol Borei', 'Ou Chrov', 'Phnum Srok', 'Poipet', 'Preah Netr Preah', 'Serei Saophoan', 'Svay Chek', 'Thma Puok'],
  Battambang: ['Aek Phnum', 'Banan', 'Battambang', 'Bavel', 'Kamrieng', 'Koas Krala', 'Moung Ruessei', 'Phnum Proek', 'Rotonak Mondol', 'Rukhak Kiri', 'Sampov Loun', 'Samlout', 'Sangkae', 'Thma Koul'],
  'Kampong Cham': ['Batheay', 'Chamkar Leu', 'Cheung Prey', 'Kampong Cham', 'Kampong Siem', 'Kang Meas', 'Koh Sotin', 'Prey Chhor', 'Srei Santhor', 'Stueng Trang'],
  'Kampong Chhnang': ['Baribour', 'Chol Kiri', 'Kampong Chhnang', 'Kampong Leaeng', 'Kampong Tralach', 'Rolea Bier', 'Sameakki Mean Chey', 'Tuek Phos'],
  'Kampong Speu': ['Aoral', 'Basedth', 'Chbar Mon', 'Kong Pisei', 'Odongk', 'Phnum Sruoch', 'Samraong Tong', 'Thpong'],
  'Kampong Thom': ['Baray', 'Kampong Svay', 'Prasat Balangk', 'Prasat Sambour', 'Sandan', 'Santuk', 'Stoung', 'Stueng Saen', 'Taing Kouk'],
  Kampot: ['Angkor Chey', 'Banteay Meas', 'Bokor', 'Chhuk', 'Chum Kiri', 'Dang Tong', 'Kampong Trach', 'Kampot', 'Tuek Chhou'],
  Kandal: ['Angk Snuol', 'Kandal Stueng', 'Kien Svay', 'Khsach Kandal', 'Koh Thum', 'Leuk Daek', 'Lvea Aem', 'Mukh Kampul', 'Ponhea Leu', 'Sang', 'Ta Khmau'],
  Kep: ['Damnak Changaeur', 'Kep'],
  'Koh Kong': ['Botum Sakor', 'Kiri Sakor', 'Khemara Phoumin', 'Koh Kong', 'Mondol Seima', 'Srae Ambel', 'Thma Bang'],
  Kratie: ['Chet Borei', 'Chhloung', 'Kratie', 'Ou Krieng Saenchey', 'Prek Prasab', 'Sambour', 'Snuol'],
  Mondulkiri: ['Kaev Seima', 'Koh Nhaek', 'Ou Reang', 'Pech Chreada', 'Saen Monourom'],
  'Oddar Meanchey': ['Anlong Veaeng', 'Banteay Ampil', 'Chong Kal', 'Samraong', 'Trapeang Prasat'],
  Pailin: ['Pailin', 'Sala Krau'],
  'Phnom Penh': ['Boeng Keng Kang', 'Chamkar Mon', 'Chbar Ampov', 'Chroy Changvar', 'Dangkao', 'Daun Penh', 'Kamboul', 'Mean Chey', 'Pou Senchey', 'Prampir Meakkakra', 'Prek Pnov', 'Russey Keo', 'Sen Sok', 'Tuol Kouk'],
  'Preah Sihanouk': ['Kampong Seila', 'Koh Rong', 'Preah Sihanouk', 'Prey Nob', 'Stueng Hav'],
  'Preah Vihear': ['Chey Saen', 'Chhaeb', 'Choam Ksant', 'Kulen', 'Preah Vihear', 'Rovieng', 'Sangkum Thmei', 'Tbaeng Mean Chey'],
  'Prey Veng': ['Ba Phnum', 'Kamchay Mear', 'Kampong Trabaek', 'Kanhchriech', 'Me Sang', 'Pea Reang', 'Peam Chor', 'Peam Ro', 'Preah Sdach', 'Prey Veng', 'Pur Rieng', 'Sithor Kandal', 'Svay Antor'],
  Pursat: ['Bakan', 'Kandieng', 'Krakor', 'Phnum Kravanh', 'Pursat', 'Ta Lou Senchey', 'Veal Veaeng'],
  Ratanakiri: ['Andoung Meas', 'Banlung', 'Bar Kaev', 'Koun Mom', 'Lumphat', 'Ou Chum', 'Ou Ya Dav', 'Ta Veaeng', 'Veun Sai'],
  'Siem Reap': ['Angkor Chum', 'Angkor Thom', 'Banteay Srei', 'Chi Kraeng', 'Kralanh', 'Prasat Bakong', 'Puok', 'Run Ta Aek', 'Siem Reap', 'Soutr Nikom', 'Srei Snam', 'Svay Leu', 'Varin'],
  'Stung Treng': ['Borei Ou Svay Senchey', 'Sesan', 'Siem Bouk', 'Siem Pang', 'Stung Treng', 'Thala Barivat'],
  'Svay Rieng': ['Bavet', 'Chantrea', 'Kampong Rou', 'Romeas Haek', 'Rumduol', 'Svay Chrum', 'Svay Rieng', 'Svay Teab'],
  Takeo: ['Angkor Borei', 'Bati', 'Borei Cholsar', 'Doun Kaev', 'Kaoh Andaet', 'Kiri Vong', 'Prey Kabbas', 'Samraong', 'Tram Kak', 'Treang'],
  'Tbong Khmum': ['Dambae', 'Krouch Chhmar', 'Memot', 'Ou Reang Ov', 'Ponhea Kraek', 'Suong', 'Tboung Khmum'],
};

/** The suggested districts of a province (empty for an unknown one). */
export const districtsOf = (province: string): readonly string[] => DISTRICTS[province] ?? [];
