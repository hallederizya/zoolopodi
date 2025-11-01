# Zoolopodi Species Import Report

## Import Summary (2025-11-01)

### Statistics
- **Total species in source file**: 19,342
- **Successfully imported**: 12,480 (64.5%)
- **Failed imports**: 10 (0.05%)
- **Not yet attempted**: 6,852 (35.4%)

### Import Runs

#### Run 1: Full Import (with media & iNat)
- Command: `npx tsx scripts/import_species.ts --file data/gbif_animalia_species.txt --concurrency 2 --skip-media --skip-inat`
- Result: 12,480 species successfully imported
- Duration: ~Several hours
- Features enabled: GBIF data, EOL descriptions, Common names

#### Run 2: Retry Failed Species
- Command: `npx tsx scripts/import_species.ts --file data/gbif_animalia_species.txt --concurrency 2 --skip-iucn --skip-inat`
- Result: 0 successful, 10 failed (GBIF match not found)
- Failed species saved to: `data/failed_species.txt`

### Failed Species (GBIF Not Found)
1. Porina africana
2. Porina australiensis
3. Dimetopia hirta
4. Crepis longipes
5. Bugula orientalis

**Note**: These species may be:
- Synonyms of other species
- Misspelled names
- Not present in GBIF database
- Require manual investigation

### Next Steps
- [ ] Review failed species manually
- [ ] Check for synonyms in GBIF
- [ ] Add media to approved species (admin panel: `/admin/media`)
- [ ] Add IUCN status for conservation-relevant species
- [ ] Add iNaturalist distribution data

### Database Status
- Total taxa in database: ~12,480+ (including parent taxa)
- Approved media: TBD (requires admin review)
- Species with IUCN status: TBD
- Species with distribution data: TBD

### Technical Notes
- Checkpoint system enabled: `.import_checkpoint.json`
- Concurrency: 2 parallel workers
- Rate limiting: 3 retries with exponential backoff for GBIF API
- Auto-revalidation: ISR cache cleared after each import
- Media approval: All new media requires admin approval (`approved=false`)
