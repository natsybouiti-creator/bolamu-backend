try {
    console.log('🔍 Test import sport-groups.routes...');
    const sportGroupsRoutes = require('../src/routes/sport-groups.routes');
    console.log('✅ Import réussi');
    console.log('Type:', typeof sportGroupsRoutes);
    console.log('Has stack?', !!sportGroupsRoutes.stack);
    console.log('Has methods?', Object.getOwnPropertyNames(sportGroupsRoutes));
} catch (error) {
    console.error('❌ Erreur import:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
}
