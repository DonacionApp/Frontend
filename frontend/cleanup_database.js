const { Client } = require('pg');

async function cleanupDatabase() {
    const client = new Client({
        host: 'localhost',
        port: 5432,
        database: 'donanapp', // Ajusta el nombre de la base de datos
        user: 'postgres', // Ajusta el usuario
        password: 'password' // Ajusta la contraseña
    });

    try {
        await client.connect();
        console.log('🔌 Conectado a la base de datos');

        // Eliminar usuarios específicos
        const deleteUsers = await client.query(`
            DELETE FROM "user" WHERE email IN (
                'pastuzanjuancarlos@gmail.com',
                'test@example.com',
                'test_cleanup@example.com',
                'test44@example.com',
                'jcpastuzanq22@itp.edu.co'
            )
        `);
        console.log(`✅ Eliminados ${deleteUsers.rowCount} usuarios`);

        // Eliminar personas asociadas
        const deletePeople = await client.query(`
            DELETE FROM "people" WHERE dni IN (
                '12345678',
                '99999999',
                '1234567890',
                '9876543210'
            )
        `);
        console.log(`✅ Eliminadas ${deletePeople.rowCount} personas`);

        // Verificar limpieza
        const userCount = await client.query('SELECT COUNT(*) as count FROM "user"');
        const peopleCount = await client.query('SELECT COUNT(*) as count FROM "people"');
        
        console.log(`📊 Usuarios restantes: ${userCount.rows[0].count}`);
        console.log(`📊 Personas restantes: ${peopleCount.rows[0].count}`);

        // Mostrar usuarios restantes
        const remainingUsers = await client.query(`
            SELECT id, username, email, emailVerified, verified 
            FROM "user" 
            LIMIT 10
        `);
        
        if (remainingUsers.rows.length > 0) {
            console.log('👥 Usuarios restantes:');
            remainingUsers.rows.forEach(user => {
                console.log(`  - ${user.email} (ID: ${user.id}, Verificado: ${user.emailVerified})`);
            });
        } else {
            console.log('🎉 ¡Base de datos completamente limpia!');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
        console.log('🔌 Desconectado de la base de datos');
    }
}

cleanupDatabase();
