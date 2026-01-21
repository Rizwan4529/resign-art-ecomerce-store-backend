const { prisma } = require("../config/db");

/**
 * Submit a contact form
 * @route POST /api/contact/submit
 * @access Public
 */
const submitContact = async (req, res) => {
  try {
    const { name, email, phone, subject, message, inquiryType } = req.body;

    // Validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide all required fields: name, email, subject, message",
      });
    }

    // Validate phone number (max 13 digits)
    if (phone) {
      const digitCount = phone.replace(/\D/g, "").length;
      if (digitCount > 13) {
        return res.status(400).json({
          success: false,
          message: "Phone number can contain a maximum of 13 digits",
        });
      }
    }

    // Create contact submission
    const contactSubmission = await prisma.contactSubmission.create({
      data: {
        name,
        email,
        phone: phone || null,
        subject,
        message,
        inquiryType: inquiryType || "General Inquiry",
      },
    });

    res.status(201).json({
      success: true,
      message: "Thank you for contacting us! We will get back to you soon.",
      data: contactSubmission,
    });
  } catch (error) {
    console.error("Error submitting contact form:", error);
    res.status(500).json({
      success: false,
      message: "Error submitting contact form",
      error: error.message,
    });
  }
};

/**
 * Get all contact submissions (Admin only)
 * @route GET /api/contact
 * @access Admin
 */
const getContacts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;
    const skip = (page - 1) * limit;

    // Get total count
    const total = await prisma.contactSubmission.count();

    // Get paginated contacts
    const contacts = await prisma.contactSubmission.findMany({
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: {
        [sortBy]: sortOrder.toLowerCase(),
      },
    });

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: contacts,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching contacts",
      error: error.message,
    });
  }
};

/**
 * Get a single contact submission by ID (Admin only)
 * @route GET /api/contact/:id
 * @access Admin
 */
const getContactById = async (req, res) => {
  try {
    const { id } = req.params;

    const contact = await prisma.contactSubmission.findUnique({
      where: { id: parseInt(id) },
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact submission not found",
      });
    }

    res.status(200).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    console.error("Error fetching contact:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching contact",
      error: error.message,
    });
  }
};

/**
 * Delete a contact submission (Admin only)
 * @route DELETE /api/contact/:id
 * @access Admin
 */
const deleteContact = async (req, res) => {
  try {
    const { id } = req.params;

    const contact = await prisma.contactSubmission.delete({
      where: { id: parseInt(id) },
    });

    res.status(200).json({
      success: true,
      message: "Contact submission deleted successfully",
      data: contact,
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Contact submission not found",
      });
    }
    console.error("Error deleting contact:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting contact",
      error: error.message,
    });
  }
};

module.exports = {
  submitContact,
  getContacts,
  getContactById,
  deleteContact,
};
