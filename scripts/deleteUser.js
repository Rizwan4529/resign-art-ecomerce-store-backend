// Script to manually delete a user and all their data
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteUser(email) {
  try {
    console.log(`\nSearching for user with email: ${email}...`);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        _count: {
          select: {
            orders: true,
            reviews: true,
            carts: true,
          },
        },
      },
    });

    if (!user) {
      console.log(`❌ User with email "${email}" not found.`);
      return;
    }

    console.log(`\n✅ Found user:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Status: ${user.status}`);
    console.log(`   Orders: ${user._count.orders}`);
    console.log(`   Reviews: ${user._count.reviews}`);

    console.log(`\n🗑️  Deleting user and all associated data...`);

    // Delete all related data
    await prisma.$transaction([
      // Delete order tracking history
      prisma.orderTracking.deleteMany({
        where: { order: { userId: user.id } },
      }),
      // Delete order items
      prisma.orderItem.deleteMany({
        where: { order: { userId: user.id } },
      }),
      // Delete payments
      prisma.payment.deleteMany({
        where: { order: { userId: user.id } },
      }),
      // Delete deliveries
      prisma.delivery.deleteMany({
        where: { order: { userId: user.id } },
      }),
      // Delete orders
      prisma.order.deleteMany({
        where: { userId: user.id },
      }),
      // Delete reviews
      prisma.review.deleteMany({
        where: { userId: user.id },
      }),
      // Delete notifications
      prisma.notification.deleteMany({
        where: { userId: user.id },
      }),
      // Delete cart items
      prisma.cartItem.deleteMany({
        where: { cart: { userId: user.id } },
      }),
      // Delete cart
      prisma.cart.deleteMany({
        where: { userId: user.id },
      }),
      // Finally, delete user
      prisma.user.delete({
        where: { id: user.id },
      }),
    ]);

    console.log(`\n✅ Successfully deleted user "${email}" and all associated data!`);
    console.log(`   You can now sign up with this email again.\n`);

  } catch (error) {
    console.error(`\n❌ Error deleting user:`, error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.log('\n❌ Please provide an email address.');
  console.log('Usage: node scripts/deleteUser.js <email>\n');
  console.log('Example: node scripts/deleteUser.js admin@yopmail.com\n');
  process.exit(1);
}

deleteUser(email);
